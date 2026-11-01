// Golden fixture: the September 2026 Payment Summary from report_format/format.tex.
// Expected values are copied from that report, never computed here.
import type { CalcInput } from '../types';

const MEMBERS = [
  { id: 's-ayman', name: 'Ayman' },
  { id: 's-saad', name: 'Saad' },
  { id: 's-alif', name: 'Alif' },
  { id: 's-asif', name: 'Asif' },
];

const MEAL_TOTALS: Record<string, number> = {
  's-ayman': 24.5,
  's-saad': 34.5,
  's-alif': 36,
  's-asif': 2,
};

export const KHALA_DAYS = 27;

/** Spreads a monthly total over the first `days` days of September in 0.5 steps. */
function spread(memberId: string, days: number) {
  const halves = Math.round((MEAL_TOTALS[memberId] ?? 0) * 2);
  return Array.from({ length: days }, (_, i) => ({
    memberId,
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    meals: (Math.floor(halves / days) + (i < halves % days ? 1 : 0)) / 2,
  }));
}

const BAZAR: Record<string, number[]> = {
  's-ayman': [520, 480, 566, 500],
  's-saad': [410, 395, 420, 403, 400],
  's-alif': [220, 230, 210, 240, 225, 215, 235, 219, 221, 219],
};

export const september2026: CalcInput = {
  members: MEMBERS,
  meals: [
    ...spread('s-ayman', KHALA_DAYS),
    ...spread('s-saad', KHALA_DAYS),
    ...spread('s-alif', KHALA_DAYS),
    ...spread('s-asif', 2),
  ],
  expenses: [
    ...Object.entries(BAZAR).flatMap(([memberId, trips]) =>
      trips.map((amount, i) => ({
        memberId,
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        amount,
        kind: 'bazar' as const,
      })),
    ),
    { memberId: 's-ayman', date: '2026-09-01', amount: 60, kind: 'initial' },
    { memberId: 's-ayman', date: '2026-09-15', amount: 60, kind: 'initial' },
    { memberId: 's-alif', date: '2026-09-02', amount: 135, kind: 'initial' },
  ],
  bills: [
    { kind: 'khala', amount: 4500 },
    { kind: 'house_rent', amount: 15500 },
    { kind: 'wifi', amount: 650 },
    { kind: 'gas', amount: 460 },
    { kind: 'extra', amount: 300 },
  ],
  rentShares: [
    { memberId: 's-ayman', fixedAmount: 4375 },
    { memberId: 's-saad', fixedAmount: 3750 },
    { memberId: 's-alif', fixedAmount: 4375 },
    { memberId: 's-asif', fixedAmount: 3000 },
  ],
  previousDues: [],
  payments: [],
};

/** Columns of the format's Payment Summary table. */
export const SEPTEMBER_EXPECTED = {
  members: {
    Ayman: {
      bazar: 2066,
      mealCost: 1599,
      haveToPay: -467,
      initialDue: '-56.25',
      total: 5254,
      final: 5329,
      settled: 5330,
    },
    Saad: {
      bazar: 2028,
      mealCost: 2251,
      haveToPay: 223,
      initialDue: '63.75',
      total: 5439,
      final: 5514,
      settled: 5515,
    },
    Alif: {
      bazar: 2234,
      mealCost: 2349,
      haveToPay: 115,
      initialDue: '-71.25',
      total: 5821,
      final: 5896,
      settled: 5900,
    },
    Asif: {
      bazar: 0,
      mealCost: 131,
      haveToPay: 131,
      initialDue: '63.75',
      total: 4597,
      final: 4672,
      settled: 4675,
    },
  },
  totals: {
    bazar: 6328,
    mealCost: 6330,
    meals: 97,
    initial: 255,
    sumFinal: 21411,
    sumSettled: 21420,
  },
  perHead: { khala: 1125, wifi: '162.5', gas: 115, extra: 75, initialRate: '63.75' },
  mealRateRounded: 65,
  bazarRate: 1582,
} as const;
