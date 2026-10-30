import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TablesInsert } from '../../types/database';
import { getSupabase } from '../supabase';
import type { BillKind, ExpenseItem } from './schemas';

/** Runs a write for one mess, then refetches that mess's bundle and activity feed. */
export function useMessMutation<I>(
  messId: string,
  fn: (messId: string, input: I) => Promise<void>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => fn(messId, input),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['bundle', messId] }),
        qc.invalidateQueries({ queryKey: ['activity', messId] }),
      ]),
  });
}

export interface NewExpense {
  periodId: string;
  memberId: string;
  date: string;
  amount: number;
  kind: 'bazar' | 'initial';
  items: ExpenseItem[];
  note?: string;
  receiptPath?: string;
}

export async function addExpense(messId: string, input: NewExpense) {
  const sb = await getSupabase();
  const row: TablesInsert<'expenses'> = {
    mess_id: messId,
    period_id: input.periodId,
    member_id: input.memberId,
    date: input.date,
    amount: input.amount,
    kind: input.kind,
    items: input.items,
    note: input.note ?? null,
    receipt_path: input.receiptPath ?? null,
  };
  const { error } = await sb.from('expenses').insert(row);
  if (error) throw error;
}

export type SoftTable = 'meal_entries' | 'expenses' | 'bills' | 'payments';

/** Soft delete (deleted = true) or restore it (Undo). */
export async function setDeleted(
  _messId: string,
  input: { table: SoftTable; id: string; deleted: boolean },
) {
  const sb = await getSupabase();
  const { error } = await sb
    .from(input.table)
    .update({ deleted_at: input.deleted ? new Date().toISOString() : null })
    .eq('id', input.id);
  if (error) throw error;
}

/** One amount per fixed bill kind: update the live row, or insert the first one. */
export async function setBill(
  messId: string,
  input: { periodId: string; kind: BillKind; amount: number; id?: string | undefined },
) {
  const sb = await getSupabase();
  const { error } = input.id
    ? await sb.from('bills').update({ amount: input.amount }).eq('id', input.id)
    : await sb.from('bills').insert({
        mess_id: messId,
        period_id: input.periodId,
        kind: input.kind,
        amount: input.amount,
      });
  if (error) throw error;
}

export async function addBill(
  messId: string,
  input: { periodId: string; kind: BillKind; amount: number; label: string },
) {
  const sb = await getSupabase();
  const { error } = await sb.from('bills').insert({
    mess_id: messId,
    period_id: input.periodId,
    kind: input.kind,
    amount: input.amount,
    label: input.label || null,
  });
  if (error) throw error;
}

/** A member's fixed rent share (null = split the remainder) or carried-in previous due. */
export async function setMemberAmount(
  messId: string,
  input: {
    table: 'rent_shares' | 'previous_dues';
    periodId: string;
    memberId: string;
    amount: number | null;
  },
) {
  const sb = await getSupabase();
  const key = { period_id: input.periodId, member_id: input.memberId };
  if (input.table === 'rent_shares') {
    const updated = await sb
      .from('rent_shares')
      .update({ fixed_amount: input.amount })
      .match(key)
      .select('member_id');
    if (updated.error) throw updated.error;
    if (updated.data.length > 0) return;
    const { error } = await sb
      .from('rent_shares')
      .insert({ mess_id: messId, ...key, fixed_amount: input.amount });
    if (error) throw error;
    return;
  }
  const amount = input.amount ?? 0;
  const updated = await sb.from('previous_dues').update({ amount }).match(key).select('member_id');
  if (updated.error) throw updated.error;
  if (updated.data.length > 0) return;
  const { error } = await sb.from('previous_dues').insert({ mess_id: messId, ...key, amount });
  if (error) throw error;
}

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank';

export async function addPayment(
  messId: string,
  input: {
    periodId: string;
    memberId: string;
    amount: number;
    method: PaymentMethod;
    date: string;
    note?: string;
  },
) {
  const sb = await getSupabase();
  const { error } = await sb.from('payments').insert({
    mess_id: messId,
    period_id: input.periodId,
    member_id: input.memberId,
    amount: input.amount,
    method: input.method,
    date: input.date,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export async function addMember(messId: string, input: { displayName: string }) {
  const sb = await getSupabase();
  const { error } = await sb
    .from('mess_members')
    .insert({ mess_id: messId, display_name: input.displayName });
  if (error) throw error;
}

export async function closePeriod(
  _messId: string,
  input: {
    periodId: string;
    snapshot: Record<string, unknown>;
    carry: { member_id: string; amount: number }[];
  },
) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('close_period', {
    p_period: input.periodId,
    p_snapshot: input.snapshot as never,
    p_carry: input.carry,
  });
  if (error) throw error;
}

export async function reopenPeriod(_messId: string, input: { periodId: string; reason: string }) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('reopen_period', {
    p_period: input.periodId,
    p_reason: input.reason,
  });
  if (error) throw error;
}
