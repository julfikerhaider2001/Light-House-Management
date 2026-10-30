import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { computeReport, type CalcInput, type Report } from '../calc';
import { getSupabase } from '../supabase';
import { BundleSchema, type Bundle, type Meal } from './schemas';

export const bundleKey = (messId: string, periodId?: string) =>
  ['bundle', messId, periodId ?? 'current'] as const;

/** Everything a period screen needs, in one RPC (get_period_bundle). */
export function useBundle(messId: string | undefined, periodId?: string) {
  return useQuery({
    queryKey: bundleKey(messId ?? '', periodId),
    enabled: messId !== undefined,
    queryFn: async (): Promise<Bundle | null> => {
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('get_period_bundle', {
        p_mess: messId ?? '',
        ...(periodId ? { p_period: periodId } : {}),
      });
      if (error) throw error;
      return data === null ? null : BundleSchema.parse(data);
    },
  });
}

/** Members who count in the month: active ones, plus anyone who left but has rows in it. */
export function periodMembers(bundle: Bundle) {
  const withRows = new Set([
    ...bundle.meals.map((m) => m.member_id),
    ...bundle.expenses.map((e) => e.member_id),
  ]);
  return bundle.members.filter((m) => m.status === 'active' || withRows.has(m.id));
}

export function toCalcInput(bundle: Bundle): CalcInput {
  return {
    members: periodMembers(bundle).map((m) => ({ id: m.id, name: m.display_name })),
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
    payments: bundle.payments.map((p) => ({ memberId: p.member_id, amount: p.amount })),
  };
}

export function useReport(bundle: Bundle | null | undefined): Report | null {
  return useMemo(() => (bundle ? computeReport(toCalcInput(bundle)) : null), [bundle]);
}

/** Upserts one member's meals for a date, optimistically, through the set_meal RPC. */
export function useSetMeal(messId: string) {
  const qc = useQueryClient();
  const key = bundleKey(messId);
  return useMutation({
    mutationFn: async (input: { memberId: string; date: string; meals: number }) => {
      const sb = await getSupabase();
      const { error } = await sb.rpc('set_meal', {
        p_mess: messId,
        p_member: input.memberId,
        p_date: input.date,
        p_meals: input.meals,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Bundle | null>(key);
      if (previous) {
        const others = previous.meals.filter(
          (m) => !(m.member_id === input.memberId && m.date === input.date),
        );
        const optimistic: Meal = {
          id: `optimistic-${input.memberId}-${input.date}`,
          member_id: input.memberId,
          date: input.date,
          meals: input.meals,
          note: null,
          updated_at: new Date().toISOString(),
        };
        qc.setQueryData<Bundle>(key, { ...previous, meals: [...others, optimistic] });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['bundle', messId] }),
  });
}

export function mealsFor(bundle: Bundle, memberId: string, date: string): number {
  return bundle.meals.find((m) => m.member_id === memberId && m.date === date)?.meals ?? 0;
}
