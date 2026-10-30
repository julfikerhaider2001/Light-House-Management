// Golden fixture: the real October 2026 sheet. Expected values are copied from the sheet,
// never computed here. Used by the unit tests (G2) and the E2E month report (G5).
import type { CalcInput } from '../types';

export const MEMBERS = [
  { id: 'm-ayman', name: 'Ayman' },
  { id: 'm-saad', name: 'Saad' },
  { id: 'm-alif', name: 'Alif' },
  { id: 'm-asif', name: 'Asif' },
] as const;

const MEAL_TOTALS: Record<string, number> = {
  'm-ayman': 23.5,
  'm-saad': 27,
  'm-alif': 22.5,
  'm-asif': 30.5,
};

/** Bazar trips per member (Saad made the most trips: 10). Amounts sum to the sheet totals. */
export const BAZAR_TRIPS: Record<string, number[]> = {
  'm-ayman': [410, 365, 298, 520, 305, 280, 370],
  'm-saad': [230, 450, 380, 512, 290, 410, 365, 420, 335, 420],
  'm-alif': [420, 386, 380],
  'm-asif': [340, 315, 402, 288, 356, 330],
};

/** The sheet's Initial Expense tab lists Saad before Ayman; map by name, never by position. */
export const INITIAL = [
  { name: 'Saad', amount: 130 },
  { name: 'Ayman', amount: 115 },
];

export const EATING_DAYS = 24;

/** Spreads each member's monthly total over 1–24 Oct in 0.5 steps (everyone eats every day). */
export function dailyMeals(memberId: string): { date: string; meals: number }[] {
  const halfSteps = Math.round((MEAL_TOTALS[memberId] ?? 0) * 2);
  const base = Math.floor(halfSteps / EATING_DAYS);
  const extra = halfSteps % EATING_DAYS;
  return Array.from({ length: EATING_DAYS }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    meals: (base + (i < extra ? 1 : 0)) / 2,
  }));
}

const byName = new Map<string, string>(MEMBERS.map((m) => [m.name, m.id]));

export const october2026: CalcInput = {
  members: MEMBERS,
  meals: MEMBERS.flatMap((m) => dailyMeals(m.id).map((d) => ({ memberId: m.id, ...d }))),
  expenses: [
    ...Object.entries(BAZAR_TRIPS).flatMap(([memberId, trips]) =>
      trips.map((amount, i) => ({
        memberId,
        date: `2026-10-${String(i * 3 + 1).padStart(2, '0')}`,
        amount,
        kind: 'bazar' as const,
      })),
    ),
    ...INITIAL.map((x) => ({
      memberId: byName.get(x.name) ?? x.name,
      date: '2026-10-01',
      amount: x.amount,
      kind: 'initial' as const,
    })),
  ],
  bills: [
    { kind: 'khala', amount: 4500 },
    { kind: 'house_rent', amount: 15500 },
    { kind: 'wifi', amount: 650 },
    { kind: 'gas', amount: 460 },
    { kind: 'extra', amount: 300 },
  ],
  rentShares: [
    { memberId: 'm-saad', fixedAmount: 3750 },
    { memberId: 'm-asif', fixedAmount: 3000 },
    { memberId: 'm-ayman', fixedAmount: null },
  ],
  previousDues: [],
};

/** Values from the sheet. */
export const EXPECTED = {
  totals: { meals: '103.5', bazar: '9577', mealRateDisplay: '92.53', mealRateOverview: '93' },
  khalaCount: 24,
  perHead: { khala: '1125', wifi: '162.5', gas: '115', initialShare: '61.25', extra: '75' },
  members: {
    Ayman: {
      mealCost: '2175',
      rent: '4375',
      haveToPay: '-373',
      initialDue: '-53.75',
      total: '5351',
      final: '5426',
      settledBase: '5425.25',
    },
    Saad: {
      mealCost: '2499',
      rent: '3750',
      haveToPay: '-1313',
      initialDue: '-68.75',
      total: '3771',
      final: '3846',
      settledBase: '3845.25',
    },
    Alif: {
      mealCost: '2082',
      rent: '4375',
      haveToPay: '896',
      initialDue: '61.25',
      total: '6735',
      final: '6810',
      settledBase: '6809.25',
    },
    Asif: {
      mealCost: '2823',
      rent: '3000',
      haveToPay: '792',
      initialDue: '61.25',
      total: '5256',
      final: '5331',
      settledBase: '5330.25',
    },
  },
  sumFinal: '21413',
  sumSettled: '21410',
} as const;
