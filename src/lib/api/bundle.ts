import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { computeReport, type Report } from '../calc';
import { toCalcInput } from '../calcInput';
import { haptic } from '../native';
import { getSupabase } from '../supabase';
import { BundleSchema, type Bundle, type Meal } from './schemas';

export { periodMembers, toCalcInput } from '../calcInput';

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
    onSuccess: () => haptic('tap'),
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) qc.setQueryData(key, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['bundle', messId] }),
  });
}

export function mealsFor(bundle: Bundle, memberId: string, date: string): number {
  return bundle.meals.find((m) => m.member_id === memberId && m.date === date)?.meals ?? 0;
}
