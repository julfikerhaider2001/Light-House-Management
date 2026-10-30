import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { getSupabase } from '../supabase';

const TABLES = [
  'meal_entries',
  'expenses',
  'bills',
  'payments',
  'rent_shares',
  'previous_dues',
  'mess_members',
  'periods',
  'activity_log',
] as const;

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error';

// Tiny external store so /status can show the live connection state.
let status: RealtimeStatus = 'idle';
const listeners = new Set<() => void>();
function setStatus(next: RealtimeStatus) {
  status = next;
  for (const l of listeners) l();
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/**
 * One channel per mess, filtered by mess_id. Any change refetches the bundle and activity
 * feed (coalesced), so every screen stays live without per-table cache surgery.
 */
export function useMessRealtime(messId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!messId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['bundle', messId] });
        void qc.invalidateQueries({ queryKey: ['activity', messId] });
      }, 120);
    };

    setStatus('connecting');
    void getSupabase().then((sb) => {
      if (cancelled) return;
      let channel = sb.channel(`mess:${messId}`);
      for (const table of TABLES) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `mess_id=eq.${messId}` },
          refresh,
        );
      }
      channel.subscribe((event) => {
        const state = String(event);
        if (state === 'SUBSCRIBED') setStatus('connected');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('error');
        else if (state === 'CLOSED') setStatus('idle');
      });
      cleanup = () => void sb.removeChannel(channel);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanup?.();
      setStatus('idle');
    };
  }, [messId, qc]);
}
