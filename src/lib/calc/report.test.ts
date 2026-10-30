import { describe, expect, it } from 'vitest';
import { Fraction } from './fraction';
import { allocate, computeReport } from './report';
import type { CalcInput } from './types';
import { BAZAR_TRIPS, EXPECTED, MEMBERS, october2026 } from './__fixtures__/october-2026';

const F = (v: string | number) => Fraction.from(v);
const expectFrac = (actual: Fraction, expected: string | number) =>
  expect(actual.eq(F(expected)), `${actual.toFixed(4)} ≠ ${expected}`).toBe(true);

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

  it('settles to exactly 21410, each member at the floor or ceil of their base', () => {
    expectFrac(report.settlement.target, EXPECTED.sumSettled);
    expectFrac(report.settlement.sumSettled, EXPECTED.sumSettled);
    expectFrac(report.settlement.error, 3);
    expectFrac(report.settlement.perError, '0.75');
    for (const [name, want] of Object.entries(EXPECTED.members)) {
      const r = row(name);
      const base = F(want.settledBase);
      expect(
        r.settled.eq(Fraction.of(base.floor())) || r.settled.eq(Fraction.of(base.ceil())),
      ).toBe(true);
      expectFrac(r.adjustment, r.settled.sub(r.final).toFixed(2));
    }
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
        { memberId: 'm-alif', amount: 809 },
      ],
    });
    const alif = withPayments.members.find((m) => m.name === 'Alif');
    expectFrac(alif?.paid ?? Fraction.ZERO, 6809);
    expectFrac(alif?.balance ?? Fraction.ONE, 0);
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

  it('splits uneven extras and settles thirds in whole taka', () => {
    const r = computeReport({ ...base, bills: [{ kind: 'extra', amount: 100 }] });
    expect(r.members[0]?.extra.eq(Fraction.of(100, 3))).toBe(true);
    expectFrac(r.settlement.sumSettled, 100);
    expect(r.members.map((m) => m.settled.toNumber())).toEqual([34, 33, 33]);
  });

  it('carries previous dues into the total and the settlement target', () => {
    const r = computeReport({
      ...base,
      previousDues: [
        { memberId: 'a', amount: 120 },
        { memberId: 'b', amount: '-20.5' },
      ],
    });
    expectFrac(r.members[0]?.total ?? Fraction.ZERO, 120);
    expectFrac(r.members[1]?.total ?? Fraction.ZERO, -21); // ROUND half away from zero
    expectFrac(r.settlement.target, '99.5');
    expectFrac(r.settlement.sumSettled, 99); // whole taka floor of a fractional target
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

describe('allocate', () => {
  it('gives leftover taka to the largest remainders, ties to the earlier entry', () => {
    const out = allocate([F('1.6'), F('1.2'), F('1.2')], (x) => x, F(4)).map((e) => e.value);
    expect(out.map((x) => x.toNumber())).toEqual([2, 1, 1]);
    const tie = allocate([F('0.5'), F('0.5')], (x) => x, F(1)).map((e) => e.value);
    expect(tie.map((x) => x.toNumber())).toEqual([1, 0]);
  });

  it('floors negative bases correctly', () => {
    const out = allocate([F('-0.25'), F('1.25')], (x) => x, F(1)).map((e) => e.value);
    // -0.25 floors to -1; its 0.75 remainder is the largest, so it gets the leftover taka.
    expect(out.map((x) => x.toNumber())).toEqual([0, 1]);
  });
});
