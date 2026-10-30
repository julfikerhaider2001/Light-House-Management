import { useQuery } from '@tanstack/react-query';
import * as z from 'zod/mini';
import { getSupabase } from '../supabase';
import { ActivitySchema } from './schemas';

/** Latest activity for a mess; realtime invalidates ['activity', messId] on every change. */
export function useActivity(messId: string, limit = 200) {
  return useQuery({
    queryKey: ['activity', messId, limit],
    queryFn: async () => {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from('activity_log')
        .select('id, mess_id, actor, action, entity, entity_id, payload, created_at')
        .eq('mess_id', messId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return z.array(ActivitySchema).parse(data);
    },
  });
}
