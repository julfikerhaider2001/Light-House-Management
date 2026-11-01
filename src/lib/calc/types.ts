import type { Fraction } from './fraction';

export type Amount = string | number;

export type BillKind = 'khala' | 'house_rent' | 'wifi' | 'gas' | 'electricity' | 'extra' | 'other';

/** What a payment is for: this month's bill, or the due carried in from earlier months. */
export type PaymentTarget = 'month' | 'previous_due';

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
  /** Members who left before this month but still have a previous due or payments in it. */
  formerMembers?: readonly CalcMember[];
  /** `appliesTo` defaults to 'month'. */
  payments?: readonly { memberId: string; amount: Amount; appliesTo?: PaymentTarget }[];
}

/** One row of the report's Payment Summary, plus the separate previous due. */
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
  /** ROUND(haveToPay + khala + rent + wifi + gas + electricity + other + initialDue): "Sub-total". */
  total: Fraction;
  extra: Fraction;
  /** total + extra, before rounding. */
  final: Fraction;
  /** final rounded up to the next ৳5: the month's "Final Pay". */
  settled: Fraction;
  /** settled − final: what rounding up added. */
  adjustment: Fraction;
  /** Paid towards this month. */
  paid: Fraction;
  /** settled − paid; positive = still owes, negative = paid more than this month's bill. */
  balance: Fraction;
  /** Carried in from earlier months; never mixed into this month's bill. */
  previousDue: Fraction;
  /** Paid towards the previous due. */
  previousPaid: Fraction;
  /** previousDue − previousPaid; zero means cleared. */
  previousBalance: Fraction;
  /** balance + previousBalance: what becomes next month's previous due on close. */
  carry: Fraction;
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
  mostInitialTrips: Leader | null;
  mostTotalSpend: Leader | null;
}

export interface Settlement {
  /** Σ bills of every kind, extra included. Previous-due sums cover former members too. */
  target: Fraction;
  sumFinal: Fraction;
  /** sumFinal − target: drift from rounding each share (the sheet's "ERROR"). */
  error: Fraction;
  /** Σ final pay, each rounded up to ৳5. */
  sumSettled: Fraction;
  /** sumSettled − sumFinal: what rounding up added for the mess. */
  roundingExtra: Fraction;
  sumPaid: Fraction;
  sumBalance: Fraction;
  sumPreviousDue: Fraction;
  sumPreviousPaid: Fraction;
  sumPreviousBalance: Fraction;
}

export interface Report {
  /** Everyone sharing this month's costs. */
  members: MemberReport[];
  /** Former members with only a previous due or payments: no share of this month's costs. */
  former: MemberReport[];
  overview: Overview;
  settlement: Settlement;
  bills: Record<BillKind, Fraction>;
}
