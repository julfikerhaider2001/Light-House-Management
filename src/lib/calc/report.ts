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

/** Per-member running totals gathered from the period's rows. */
interface Tally {
  member: CalcMember;
  meals: Fraction;
  bazar: Fraction;
  bazarTrips: number;
  initialPaid: Fraction;
  fixedRent: Fraction | null;
  previousDue: Fraction;
  paid: Fraction;
}

/**
 * Replicates the mess Google Sheet. Single source of truth for every number the app shows,
 * the month-close snapshot and the dues carried forward.
 */
export function computeReport(input: CalcInput): Report {
  const tallies: Tally[] = input.members.map((member) => ({
    member,
    meals: Fraction.ZERO,
    bazar: Fraction.ZERO,
    bazarTrips: 0,
    initialPaid: Fraction.ZERO,
    fixedRent: null,
    previousDue: Fraction.ZERO,
    paid: Fraction.ZERO,
  }));
  // Rows for anyone outside the period's members are ignored.
  const byId = new Map(tallies.map((t) => [t.member.id, t]));
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
    }
  }
  for (const r of input.rentShares ?? []) {
    const t = byId.get(r.memberId);
    if (t && r.fixedAmount !== null) t.fixedRent = Fraction.from(r.fixedAmount);
  }
  for (const d of input.previousDues ?? []) {
    const t = byId.get(d.memberId);
    if (t) t.previousDue = t.previousDue.add(Fraction.from(d.amount));
  }
  for (const p of input.payments ?? []) {
    const t = byId.get(p.memberId);
    if (t) t.paid = t.paid.add(Fraction.from(p.amount));
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
  const totalPreviousDue = sumOf((t) => t.previousDue);
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

  const rows = tallies.map((t) => {
    const mealCost = Fraction.of(t.meals.mul(mealRate).ceil());
    const haveToPay = mealCost.sub(t.bazar);
    const rent = t.fixedRent ?? flexibleRent;
    const initialDue = initialShare.sub(t.initialPaid);
    const total = Fraction.sum([
      haveToPay,
      khala,
      rent,
      wifi,
      gas,
      electricity,
      other,
      initialDue,
      t.previousDue,
    ]).round(0);
    return {
      memberId: t.member.id,
      name: t.member.name,
      meals: t.meals,
      bazar: t.bazar,
      initialPaid: t.initialPaid,
      mealCost,
      haveToPay,
      khala,
      rent,
      wifi,
      gas,
      electricity,
      other,
      initialDue,
      previousDue: t.previousDue,
      total,
      extra,
      final: total.add(extra),
      paid: t.paid,
    };
  });

  const target = Fraction.sum([...BILL_KINDS.map((k) => bills[k]), totalPreviousDue]);
  const sumFinal = Fraction.sum(rows.map((r) => r.final));
  const error = sumFinal.sub(target);
  const perError = perHead(error);

  const members: MemberReport[] = allocate(rows, (r) => r.final.sub(perError), target).map(
    ({ item: r, value: settled }) => ({
      ...r,
      settled,
      adjustment: settled.sub(r.final),
      balance: settled.sub(r.paid),
    }),
  );

  const settlement: Settlement = {
    target,
    sumFinal,
    error,
    perError,
    sumSettled: Fraction.sum(members.map((m) => m.settled)),
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
    totalMealCost: Fraction.sum(members.map((m) => m.mealCost)),
    khalaCount: eatingDays.size,
    mostMeals: leader(tallies, (t) => t.meals),
    mostBazar: leader(tallies, (t) => t.bazar),
    mostBazarTrips: leader(tallies, (t) => Fraction.of(t.bazarTrips)),
    mostInitial: leader(tallies, (t) => t.initialPaid),
    mostTotalSpend: leader(tallies, (t) => t.bazar.add(t.initialPaid)),
  };

  return { members, overview, settlement, bills };
}

/**
 * Splits `target` into whole taka across items whose bases sum to `target`: floor every
 * base, then hand the leftover taka to the largest fractional remainders. Ties go to the
 * earlier item so the result is stable. A fractional target settles to its whole-taka floor.
 */
export function allocate<T>(
  items: readonly T[],
  base: (item: T) => Fraction,
  target: Fraction,
): { item: T; value: Fraction }[] {
  const entries = items.map((item, index) => {
    const b = base(item);
    const floor = b.floor();
    return { item, index, floor, remainder: b.sub(Fraction.of(floor)) };
  });
  const leftover = Number(target.floor() - entries.reduce((s, e) => s + e.floor, 0n));
  const winners = new Set(
    [...entries]
      .sort((a, b) => b.remainder.cmp(a.remainder) || a.index - b.index)
      .slice(0, Math.max(0, leftover)),
  );
  return entries.map((e) => ({
    item: e.item,
    value: Fraction.of(winners.has(e) ? e.floor + 1n : e.floor),
  }));
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
