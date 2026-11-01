import { describe, expect, it } from 'vitest';
import { Fraction } from './fraction';
import { computeReport, roundUp } from './report';
import type { CalcInput } from './types';
import { BAZAR_TRIPS, EXPECTED, MEMBERS, october2026 } from './__fixtures__/october-2026';
import { KHALA_DAYS, SEPTEMBER_EXPECTED, september2026 } from './__fixtures__/september-2026';

const F = (v: string | number) => Fraction.from(v);
const expectFrac = (actual: Fraction, expected: string | number) =>
  expect(actual.eq(F(expected)), `${actual.toFixed(4)} ≠ ${expected}`).toBe(true);

describe('golden fixture: September 2026 (report_format/format.tex)', () => {
  const report = computeReport(september2026);
  const row = (name: string) => {
    const r = report.members.find((m) => m.name === name);
    if (!r) throw new Error(`no row for ${name}`);
    return r;
  };

  it.each(Object.entries(SEPTEMBER_EXPECTED.members))('matches the row for %s', (name, want) => {
    const r = row(name);
    expectFrac(r.bazar, want.bazar);
    expectFrac(r.mealCost, want.mealCost);
    expectFrac(r.haveToPay, want.haveToPay);
    expectFrac(r.initialDue, want.initialDue);
    expectFrac(r.total, want.total);
    expectFrac(r.final, want.final);
    expectFrac(r.settled, want.settled);
    expectFrac(r.previousDue, 0);
  });

  it('matches the totals, rates and the rounding note', () => {
    const o = report.overview;
    const s = report.settlement;
    const want = SEPTEMBER_EXPECTED;
    expectFrac(o.totalBazar, want.totals.bazar);
    expectFrac(o.totalMealCost, want.totals.mealCost);
    expectFrac(o.totalMeals, want.totals.meals);
    expectFrac(o.totalInitial, want.totals.initial);
    expectFrac(o.mealRateRounded, want.mealRateRounded);
    expectFrac(o.bazarRate, want.bazarRate);
    expectFrac(o.initialRate, want.perHead.initialRate);
    expect(o.khalaCount).toBe(KHALA_DAYS);
    expectFrac(s.sumFinal, want.totals.sumFinal);
    expectFrac(s.sumSettled, want.totals.sumSettled);
    expectFrac(s.roundingExtra, 9);
    const ayman = row('Ayman');
    expectFrac(ayman.khala, want.perHead.khala);
    expectFrac(ayman.wifi, want.perHead.wifi);
    expectFrac(ayman.gas, want.perHead.gas);
    expectFrac(ayman.extra, want.perHead.extra);
  });

  it('matches the highlights', () => {
    const o = report.overview;
    expect(o.mostMeals?.name).toBe('Alif');
    expectFrac(o.mostMeals?.value ?? Fraction.ZERO, 36);
    expect(o.mostBazar?.name).toBe('Alif');
    expect(o.mostInitial?.name).toBe('Alif');
    expectFrac(o.mostInitial?.value ?? Fraction.ZERO, 135);
    expect(o.mostBazarTrips?.name).toBe('Alif');
    expectFrac(o.mostBazarTrips?.value ?? Fraction.ZERO, 10);
    expect(o.mostInitialTrips?.name).toBe('Ayman');
    expectFrac(o.mostInitialTrips?.value ?? Fraction.ZERO, 2);
    expect(o.mostTotalSpend?.name).toBe('Alif');
    expectFrac(o.mostTotalSpend?.value ?? Fraction.ZERO, 2369);
  });
});

describe('golden fixture: October 2026', () => {
  const report = computeReport(october2026);
  const row = (name: string) => {
    const r = report.members.find((m) => m.name === name);
    if (!r) throw new Error(`no row for ${name}`);
    return r;
  };

  it('matches the sheet totals and meal rate', () => {
    const o = report.overview;
    expectFrac(o.totalMeals, EXPECTED.totals.meals);
    expectFrac(o.totalBazar, EXPECTED.totals.bazar);
    expect(o.mealRate.toFixed(2)).toBe(EXPECTED.totals.mealRateDisplay);
    expect(o.mealRate.toFixed(4)).toBe('92.5314');
    expectFrac(o.mealRateRounded, EXPECTED.totals.mealRateOverview);
    expect(o.khalaCount).toBe(EXPECTED.khalaCount);
  });

  it('matches the per-head shares', () => {
    const ayman = row('Ayman');
    expectFrac(ayman.khala, EXPECTED.perHead.khala);
    expectFrac(ayman.wifi, EXPECTED.perHead.wifi);
    expectFrac(ayman.gas, EXPECTED.perHead.gas);
    expectFrac(ayman.extra, EXPECTED.perHead.extra);
    expectFrac(report.overview.initialRate, EXPECTED.perHead.initialShare);
  });

  it.each(Object.entries(EXPECTED.members))('matches the sheet row for %s', (name, want) => {
    const r = row(name);
    expectFrac(r.mealCost, want.mealCost);
    expectFrac(r.rent, want.rent);
    expectFrac(r.haveToPay, want.haveToPay);
    expectFrac(r.initialDue, want.initialDue);
    expectFrac(r.total, want.total);
    expectFrac(r.final, want.final);
  });

  it('sheet-compatible finals sum to 21413', () => {
    expectFrac(report.settlement.sumFinal, EXPECTED.sumFinal);
    expectFrac(Fraction.sum(report.members.map((m) => m.final)), EXPECTED.sumFinal);
  });

  it('rounds each final pay up to the next ৳5', () => {
    expectFrac(report.settlement.target, EXPECTED.sumSettled);
    expectFrac(report.settlement.error, 3);
    expect(report.members.map((m) => m.settled.toNumber())).toEqual([5430, 3850, 6810, 5335]);
    expectFrac(report.settlement.sumSettled, 21425);
    expectFrac(report.settlement.roundingExtra, 12);
    for (const r of report.members) expectFrac(r.adjustment, r.settled.sub(r.final).toFixed(2));
  });

  it('computes the overview leaders', () => {
    const o = report.overview;
    expect(o.mostMeals?.name).toBe('Asif');
    expect(o.mostBazar?.name).toBe('Saad');
    expect(o.mostBazarTrips?.name).toBe('Saad');
    expect(o.mostBazarTrips?.value.toNumber()).toBe(10);
    expect(o.mostInitial?.name).toBe('Saad');
    expect(o.mostTotalSpend?.name).toBe('Saad');
    expectFrac(o.mostTotalSpend?.value ?? Fraction.ZERO, 3942);
    expectFrac(o.totalInitial, 245);
    expectFrac(o.bazarRate, '2394.25');
    expectFrac(o.totalMealCost, 9579);
    expect(o.activeMembers).toBe(4);
  });

  it('fixture bazar trips add up to the sheet totals', () => {
    const sum = (xs: number[] | undefined) => (xs ?? []).reduce((a, b) => a + b, 0);
    expect(sum(BAZAR_TRIPS['m-ayman'])).toBe(2548);
    expect(sum(BAZAR_TRIPS['m-saad'])).toBe(3812);
    expect(sum(BAZAR_TRIPS['m-alif'])).toBe(1186);
    expect(sum(BAZAR_TRIPS['m-asif'])).toBe(2031);
  });

  it('balances against payments', () => {
    const withPayments = computeReport({
      ...october2026,
      payments: [
        { memberId: 'm-alif', amount: 6000 },
        { memberId: 'm-alif', amount: 810 },
      ],
    });
    const alif = withPayments.members.find((m) => m.name === 'Alif');
    expectFrac(alif?.paid ?? Fraction.ZERO, 6810);
    expectFrac(alif?.balance ?? Fraction.ONE, 0);
    expectFrac(alif?.carry ?? Fraction.ONE, 0);
  });
});

describe('computeReport edge cases', () => {
  const base: CalcInput = {
    members: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ],
    meals: [],
    expenses: [],
    bills: [],
  };

  it('handles an empty month', () => {
    const r = computeReport(base);
    expectFrac(r.overview.mealRate, 0);
    expect(r.overview.khalaCount).toBe(0);
    expect(r.overview.mostMeals).toBeNull();
    expect(r.members.every((m) => m.settled.isZero())).toBe(true);
  });

  it('handles no members', () => {
    const r = computeReport({ ...base, members: [], bills: [{ kind: 'wifi', amount: 600 }] });
    expect(r.members).toEqual([]);
    expectFrac(r.overview.bazarRate, 0);
  });

  it('splits uneven extras and rounds each final pay up to ৳5', () => {
    const r = computeReport({ ...base, bills: [{ kind: 'extra', amount: 100 }] });
    expect(r.members[0]?.extra.eq(Fraction.of(100, 3))).toBe(true);
    expect(r.members.map((m) => m.settled.toNumber())).toEqual([35, 35, 35]);
    expectFrac(r.settlement.sumSettled, 105);
    expectFrac(r.settlement.roundingExtra, 5);
  });

  it('keeps previous dues out of this month and settles them separately', () => {
    const r = computeReport({
      ...base,
      bills: [{ kind: 'khala', amount: 300 }],
      // A owes 500 from last month but did 400 of bazar this month.
      expenses: [{ memberId: 'a', date: '2026-10-01', amount: 400, kind: 'bazar' }],
      meals: [{ memberId: 'b', date: '2026-10-01', meals: 4 }],
      previousDues: [
        { memberId: 'a', amount: 500 },
        { memberId: 'b', amount: '-20.5' },
      ],
      payments: [
        { memberId: 'a', amount: 300, appliesTo: 'previous_due' },
        { memberId: 'a', amount: 100 },
      ],
    });
    const [a, b] = r.members;
    // This month: A's bazar is credited against this month only (−400 + 100 khala).
    expectFrac(a?.total ?? Fraction.ONE, -300);
    expectFrac(a?.settled ?? Fraction.ONE, -300);
    expectFrac(a?.paid ?? Fraction.ONE, 100);
    expectFrac(a?.balance ?? Fraction.ONE, -400);
    // The old due is untouched by the bazar: 500 − 300 paid = 200 still due.
    expectFrac(a?.previousDue ?? Fraction.ONE, 500);
    expectFrac(a?.previousPaid ?? Fraction.ONE, 300);
    expectFrac(a?.previousBalance ?? Fraction.ONE, 200);
    expectFrac(a?.carry ?? Fraction.ONE, -200);
    // B's credit stays in the previous-due section too.
    expectFrac(b?.total ?? Fraction.ONE, 500);
    expectFrac(b?.previousBalance ?? Fraction.ONE, '-20.5');
    expectFrac(r.settlement.target, 300);
    expectFrac(r.settlement.sumPreviousDue, '479.5');
    expectFrac(r.settlement.sumPreviousBalance, '179.5');
  });

  it('keeps a former member with an old due out of the month split', () => {
    const r = computeReport({
      ...base,
      bills: [{ kind: 'khala', amount: 300 }],
      formerMembers: [{ id: 'gone', name: 'Gone' }],
      previousDues: [{ memberId: 'gone', amount: 800 }],
      payments: [{ memberId: 'gone', amount: 500, appliesTo: 'previous_due' }],
    });
    expect(r.members.map((m) => m.khala.toNumber())).toEqual([100, 100, 100]);
    expect(r.overview.activeMembers).toBe(3);
    const gone = r.former[0];
    expectFrac(gone?.settled ?? Fraction.ONE, 0);
    expectFrac(gone?.previousBalance ?? Fraction.ONE, 300);
    expectFrac(gone?.carry ?? Fraction.ONE, 300);
    expectFrac(r.settlement.sumPreviousBalance, 300);
  });

  it('rounds up to the next multiple of ৳5, negatives towards zero', () => {
    expect(
      [5329, 5514, 5896, 4672, 5330, 0, '0.2', -467].map((v) => roundUp(F(v)).toNumber()),
    ).toEqual([5330, 5515, 5900, 4675, 5330, 0, 5, -465]);
  });

  it('splits rent among members without a fixed share; all-fixed leaves no remainder', () => {
    const someFixed = computeReport({
      ...base,
      bills: [{ kind: 'house_rent', amount: 10000 }],
      rentShares: [
        { memberId: 'a', fixedAmount: 4000 },
        { memberId: 'b', fixedAmount: null },
      ],
    });
    expect(someFixed.members.map((m) => m.rent.toNumber())).toEqual([4000, 3000, 3000]);

    const allFixed = computeReport({
      ...base,
      bills: [{ kind: 'house_rent', amount: 9000 }],
      rentShares: base.members.map((m) => ({ memberId: m.id, fixedAmount: 3000 })),
    });
    expect(allFixed.members.map((m) => m.rent.toNumber())).toEqual([3000, 3000, 3000]);
  });

  it('applies electricity and other like wifi, and sums repeated bills', () => {
    const r = computeReport({
      ...base,
      bills: [
        { kind: 'electricity', amount: 1000 },
        { kind: 'other', amount: 50 },
        { kind: 'other', amount: 50 },
      ],
    });
    expectFrac(r.members[0]?.electricity ?? Fraction.ZERO, '333.3');
    expectFrac(r.members[0]?.other ?? Fraction.ZERO, '33.3');
    expectFrac(r.bills.other, 100);
  });

  it('ignores rows for members outside the period and zero-meal days', () => {
    const r = computeReport({
      ...base,
      meals: [
        { memberId: 'a', date: '2026-10-01', meals: 0 },
        { memberId: 'zz', date: '2026-10-02', meals: 3 },
        { memberId: 'b', date: '2026-10-03', meals: '1.5' },
      ],
      expenses: [{ memberId: 'zz', date: '2026-10-02', amount: 999, kind: 'bazar' }],
      rentShares: [{ memberId: 'zz', fixedAmount: 1 }],
      previousDues: [{ memberId: 'zz', amount: 5 }],
      payments: [{ memberId: 'zz', amount: 5 }],
    });
    expectFrac(r.overview.totalMeals, '1.5');
    expectFrac(r.overview.totalBazar, 0);
    expect(r.overview.khalaCount).toBe(1);
    expect(r.overview.mostMeals?.name).toBe('B');
  });

  it('keeps the first member as leader on ties', () => {
    const r = computeReport({
      ...base,
      meals: [
        { memberId: 'a', date: '2026-10-01', meals: 2 },
        { memberId: 'b', date: '2026-10-01', meals: 2 },
      ],
    });
    expect(r.overview.mostMeals?.name).toBe('A');
  });

  it('uses the shared fixture member order', () => {
    expect(MEMBERS.map((m) => m.name)).toEqual(['Ayman', 'Saad', 'Alif', 'Asif']);
  });
});
