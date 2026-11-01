import type { CalcInput, Report } from './calc';
import type { Bundle } from './api/schemas';

// Pure (no React, no Supabase client) so the month mailer script can share it with the app.

/** Members who count in the month: active ones, plus anyone who left but has rows in it. */
export function periodMembers(bundle: Bundle) {
  const withRows = new Set([
    ...bundle.meals.map((m) => m.member_id),
    ...bundle.expenses.map((e) => e.member_id),
  ]);
  return bundle.members.filter((m) => m.status === 'active' || withRows.has(m.id));
}

/** Members who left but still have a previous due or a payment in this month. */
export function formerMembers(bundle: Bundle) {
  const sharing = new Set(periodMembers(bundle).map((m) => m.id));
  const withMoney = new Set([
    ...bundle.payments.map((p) => p.member_id),
    ...bundle.previous_dues.filter((d) => d.amount !== 0).map((d) => d.member_id),
  ]);
  return bundle.members.filter((m) => !sharing.has(m.id) && withMoney.has(m.id));
}

export function toCalcInput(bundle: Bundle): CalcInput {
  return {
    members: periodMembers(bundle).map((m) => ({ id: m.id, name: m.display_name })),
    formerMembers: formerMembers(bundle).map((m) => ({ id: m.id, name: m.display_name })),
    meals: bundle.meals.map((m) => ({ memberId: m.member_id, date: m.date, meals: m.meals })),
    expenses: bundle.expenses.map((e) => ({
      memberId: e.member_id,
      date: e.date,
      amount: e.amount,
      kind: e.kind,
    })),
    bills: bundle.bills.map((b) => ({ kind: b.kind, amount: b.amount })),
    rentShares: bundle.rent_shares.map((r) => ({
      memberId: r.member_id,
      fixedAmount: r.fixed_amount,
    })),
    previousDues: bundle.previous_dues.map((d) => ({ memberId: d.member_id, amount: d.amount })),
    payments: bundle.payments.map((p) => ({
      memberId: p.member_id,
      amount: p.amount,
      appliesTo: p.applies_to ?? 'month',
    })),
  };
}

/**
 * What each member carries into next month's previous due: this month's unpaid final pay plus
 * whatever of the old due is still unpaid (negative = credit). Former members included.
 */
export function closingCarry(report: Report): { member_id: string; amount: number }[] {
  return [...report.members, ...report.former].map((m) => ({
    member_id: m.memberId,
    amount: Number(m.carry.toFixed(2)),
  }));
}
