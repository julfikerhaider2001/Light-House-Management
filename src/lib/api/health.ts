import { useQuery } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { getSupabase, isSupabaseConfigured } from '../supabase';

const HealthSchema = z.object({
  status: z.literal('healthy'),
  version: z.nullable(z.string()),
});

export type Health = z.infer<typeof HealthSchema> & { latencyMs: number };

export async function fetchHealth(): Promise<Health> {
  const supabase = await getSupabase();
  const started = performance.now();
  const { data, error } = await supabase.rpc('health');
  const latencyMs = performance.now() - started;
  if (error) throw new Error(error.message);
  return { ...HealthSchema.parse(data), latencyMs };
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    enabled: isSupabaseConfigured,
    refetchInterval: 30_000,
  });
}
