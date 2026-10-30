import type { Fraction } from './fraction';

export type Amount = string | number;

export type BillKind = 'khala' | 'house_rent' | 'wifi' | 'gas' | 'electricity' | 'extra' | 'other';

export interface CalcMember {
  id: string;
  name: string;
}

export interface CalcInput {
  /** The members included in this period (the sheet's "active" members). */
  members: readonly CalcMember[];
  meals: readonly { memberId: string; date: string; meals: Amount }[];
  expenses: readonly {
    memberId: string;
    date: string;
    amount: Amount;
    kind: 'bazar' | 'initial';
  }[];
  bills: readonly { kind: BillKind; amount: Amount }[];
  rentShares?: readonly { memberId: string; fixedAmount: Amount | null }[];
  previousDues?: readonly { memberId: string; amount: Amount }[];
  payments?: readonly { memberId: string; amount: Amount }[];
}

/** One row of the sheet's "Total Expenses" tab, plus settlement columns. */
export interface MemberReport {
  memberId: string;
  name: string;
  meals: Fraction;
  bazar: Fraction;
  initialPaid: Fraction;
  /** CEIL(meals × meal rate), whole taka. */
  mealCost: Fraction;
  /** mealCost − bazar; negative means the mess owes them. */
  haveToPay: Fraction;
  khala: Fraction;
  rent: Fraction;
  wifi: Fraction;
  gas: Fraction;
  electricity: Fraction;
  other: Fraction;
  initialDue: Fraction;
  previousDue: Fraction;
  /** ROUND(haveToPay + khala + rent + wifi + gas + electricity + other + initialDue + previousDue). */
  total: Fraction;
  extra: Fraction;
  /** total + extra: the sheet-compatible "Final Payment". */
  final: Fraction;
  /** Whole-taka amount after reconciling rounding so the mess balances exactly. */
  settled: Fraction;
  /** settled − final, shown transparently (the sheet's "Per ERROR"). */
  adjustment: Fraction;
  paid: Fraction;
  /** settled − paid; positive = still owes, negative = credit carried forward. */
  balance: Fraction;
}

export interface Leader {
  memberId: string;
  name: string;
  value: Fraction;
}

export interface Overview {
  activeMembers: number;
  totalMeals: Fraction;
  totalBazar: Fraction;
  totalInitial: Fraction;
  /** Unrounded; display with 2 dp. */
  mealRate: Fraction;
  /** ROUND(mealRate, 0), as the sheet's overview shows it. */
  mealRateRounded: Fraction;
  bazarRate: Fraction;
  initialRate: Fraction;
  totalMealCost: Fraction;
  /** Days where anyone ate more than 0 meals. */
  khalaCount: number;
  mostMeals: Leader | null;
  mostBazar: Leader | null;
  mostBazarTrips: Leader | null;
  mostInitial: Leader | null;
  mostTotalSpend: Leader | null;
}

export interface Settlement {
  /** Σ bills (all kinds except extra) + extra + Σ previous dues. */
  target: Fraction;
  sumFinal: Fraction;
  /** sumFinal − target: the sheet's "ERROR". */
  error: Fraction;
  /** error / active: the sheet's "Per ERROR". */
  perError: Fraction;
  sumSettled: Fraction;
}

export interface Report {
  members: MemberReport[];
  overview: Overview;
  settlement: Settlement;
  bills: Record<BillKind, Fraction>;
}
