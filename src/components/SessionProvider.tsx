import { useEffect, useState, type ReactNode } from 'react';
import { SessionContext, type SessionState } from '../lib/api/session';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(
    isSupabaseConfigured ? { status: 'loading' } : { status: 'ready', session: null },
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getSupabase().then(async (sb) => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;
      setState({ status: 'ready', session: data.session });
      const sub = sb.auth.onAuthStateChange((_event, session) => {
        setState({ status: 'ready', session });
      });
      unsubscribe = () => sub.data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
