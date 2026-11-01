import { Fraction } from './fraction';
import type {
  BillKind,
  CalcInput,
  CalcMember,
  Leader,
  MemberReport,
  Overview,
  Report,
  Settlement,
} from './types';

const BILL_KINDS: readonly BillKind[] = [
  'khala',
  'house_rent',
  'wifi',
  'gas',
  'electricity',
  'extra',
  'other',
];

/** Final pay is rounded up to a round figure: the next multiple of ৳5. */
export const ROUND_UP_TO = 5;

/** Per-member running totals gathered from the period's rows. */
interface Tally {
  member: CalcMember;
  meals: Fraction;
  bazar: Fraction;
  bazarTrips: number;
  initialPaid: Fraction;
  initialTrips: number;
  fixedRent: Fraction | null;
  previousDue: Fraction;
  paid: Fraction;
  previousPaid: Fraction;
}

/**
 * Replicates the mess sheet's Payment Summary. Single source of truth for every number the app
 * shows, the month-close snapshot, the month emails and the dues carried forward.
 *
 * Each month stands alone: a previous due is reported (and paid) separately and never mixed
 * into this month's bill, so bazar done this month cannot hide an unpaid old due.
 */
export function computeReport(input: CalcInput): Report {
  const tally = (member: CalcMember): Tally => ({
    member,
    meals: Fraction.ZERO,
    bazar: Fraction.ZERO,
    bazarTrips: 0,
    initialPaid: Fraction.ZERO,
    initialTrips: 0,
    fixedRent: null,
    previousDue: Fraction.ZERO,
    paid: Fraction.ZERO,
    previousPaid: Fraction.ZERO,
  });
  const tallies = input.members.map(tally);
  const formerTallies = (input.formerMembers ?? []).map(tally);
  // Former members only carry dues and payments; any other row of theirs is ignored, as are
  // rows for anyone outside the period.
  const byId = new Map(tallies.map((t) => [t.member.id, t]));
  const withFormer = new Map([...formerTallies.map((t) => [t.member.id, t] as const), ...byId]);
  const eatingDays = new Set<string>();

  for (const e of input.meals) {
    const t = byId.get(e.memberId);
    if (!t) continue;
    const meals = Fraction.from(e.meals);
    t.meals = t.meals.add(meals);
    if (meals.cmp(Fraction.ZERO) > 0) eatingDays.add(e.date);
  }
  for (const x of input.expenses) {
    const t = byId.get(x.memberId);
    if (!t) continue;
    if (x.kind === 'bazar') {
      t.bazar = t.bazar.add(Fraction.from(x.amount));
      t.bazarTrips += 1;
    } else {
      t.initialPaid = t.initialPaid.add(Fraction.from(x.amount));
      t.initialTrips += 1;
    }
  }
  for (const r of input.rentShares ?? []) {
    const t = byId.get(r.memberId);
    if (t && r.fixedAmount !== null) t.fixedRent = Fraction.from(r.fixedAmount);
  }
  for (const d of input.previousDues ?? []) {
    const t = withFormer.get(d.memberId);
    if (t) t.previousDue = t.previousDue.add(Fraction.from(d.amount));
  }
  for (const p of input.payments ?? []) {
    const t = withFormer.get(p.memberId);
    if (!t) continue;
    if (p.appliesTo === 'previous_due')
      t.previousPaid = t.previousPaid.add(Fraction.from(p.amount));
    else t.paid = t.paid.add(Fraction.from(p.amount));
  }

  const bills = Object.fromEntries(BILL_KINDS.map((k) => [k, Fraction.ZERO])) as Record<
    BillKind,
    Fraction
  >;
  for (const b of input.bills) bills[b.kind] = bills[b.kind].add(Fraction.from(b.amount));

  const sumOf = (pick: (t: Tally) => Fraction) => Fraction.sum(tallies.map(pick));
  const totalMeals = sumOf((t) => t.meals);
  const totalBazar = sumOf((t) => t.bazar);
  const totalInitial = sumOf((t) => t.initialPaid);
  const active = tallies.length;
  const perHead = (total: Fraction) =>
    active === 0 ? Fraction.ZERO : total.div(Fraction.of(active));

  const mealRate = totalMeals.isZero() ? Fraction.ZERO : totalBazar.div(totalMeals);
  const khala = perHead(bills.khala).round(0);
  const wifi = perHead(bills.wifi).round(1);
  const gas = perHead(bills.gas).round(1);
  const electricity = perHead(bills.electricity).round(1);
  const other = perHead(bills.other).round(1);
  const extra = perHead(bills.extra);
  const initialShare = perHead(totalInitial);

  const fixedTotal = Fraction.sum(tallies.flatMap((t) => (t.fixedRent ? [t.fixedRent] : [])));
  const flexibleCount = tallies.filter((t) => t.fixedRent === null).length;
  const flexibleRent =
    flexibleCount === 0
      ? Fraction.ZERO
      : bills.house_rent.sub(fixedTotal).div(Fraction.of(flexibleCount)).round(0);

  const row = (t: Tally, shares: boolean): MemberReport => {
    const share = (x: Fraction) => (shares ? x : Fraction.ZERO);
    const mealCost = Fraction.of(t.meals.mul(mealRate).ceil());
    const haveToPay = mealCost.sub(t.bazar);
    const rent = share(t.fixedRent ?? flexibleRent);
    const initialDue = share(initialShare).sub(t.initialPaid);
    const total = Fraction.sum([
      haveToPay,
      share(khala),
      rent,
      share(wifi),
      share(gas),
      share(electricity),
      share(other),
      initialDue,
    ]).round(0);
    const final = total.add(share(extra));
    const settled = roundUp(final);
    const balance = settled.sub(t.paid);
    const previousBalance = t.previousDue.sub(t.previousPaid);
    return {
      memberId: t.member.id,
      name: t.member.name,
      meals: t.meals,
      bazar: t.bazar,
      initialPaid: t.initialPaid,
      mealCost,
      haveToPay,
      khala: share(khala),
      rent,
      wifi: share(wifi),
      gas: share(gas),
      electricity: share(electricity),
      other: share(other),
      initialDue,
      total,
      extra: share(extra),
      final,
      settled,
      adjustment: settled.sub(final),
      paid: t.paid,
      balance,
      previousDue: t.previousDue,
      previousPaid: t.previousPaid,
      previousBalance,
      carry: balance.add(previousBalance),
    };
  };
  const members = tallies.map((t) => row(t, true));
  const former = formerTallies.map((t) => row(t, false));

  const target = Fraction.sum(BILL_KINDS.map((k) => bills[k]));
  const total = (pick: (m: MemberReport) => Fraction) => Fraction.sum(members.map(pick));
  const everyone = (pick: (m: MemberReport) => Fraction) =>
    Fraction.sum([...members, ...former].map(pick));
  const sumFinal = total((m) => m.final);
  const sumSettled = total((m) => m.settled);
  const settlement: Settlement = {
    target,
    sumFinal,
    error: sumFinal.sub(target),
    sumSettled,
    roundingExtra: sumSettled.sub(sumFinal),
    sumPaid: total((m) => m.paid),
    sumBalance: total((m) => m.balance),
    sumPreviousDue: everyone((m) => m.previousDue),
    sumPreviousPaid: everyone((m) => m.previousPaid),
    sumPreviousBalance: everyone((m) => m.previousBalance),
  };

  const overview: Overview = {
    activeMembers: active,
    totalMeals,
    totalBazar,
    totalInitial,
    mealRate,
    mealRateRounded: mealRate.round(0),
    bazarRate: perHead(totalBazar),
    initialRate: initialShare,
    totalMealCost: total((m) => m.mealCost),
    khalaCount: eatingDays.size,
    mostMeals: leader(tallies, (t) => t.meals),
    mostBazar: leader(tallies, (t) => t.bazar),
    mostBazarTrips: leader(tallies, (t) => Fraction.of(t.bazarTrips)),
    mostInitial: leader(tallies, (t) => t.initialPaid),
    mostInitialTrips: leader(tallies, (t) => Fraction.of(t.initialTrips)),
    mostTotalSpend: leader(tallies, (t) => t.bazar.add(t.initialPaid)),
  };

  return { members, former, overview, settlement, bills };
}

/** Rounds up to the next multiple of ROUND_UP_TO (5329 → 5330, 5896 → 5900, −467 → −465). */
export function roundUp(value: Fraction): Fraction {
  const step = BigInt(ROUND_UP_TO);
  return Fraction.of(value.div(Fraction.of(step)).ceil() * step);
}

function leader(tallies: readonly Tally[], pick: (t: Tally) => Fraction): Leader | null {
  let best: Leader | null = null;
  for (const t of tallies) {
    const value = pick(t);
    if (value.cmp(Fraction.ZERO) <= 0) continue;
    if (best === null || value.cmp(best.value) > 0) {
      best = { memberId: t.member.id, name: t.member.name, value };
    }
  }
  return best;
}
