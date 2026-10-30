import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import { getSupabase } from '../supabase';

export type SessionState = { status: 'loading' } | { status: 'ready'; session: Session | null };

export const SessionContext = createContext<SessionState>({ status: 'loading' });

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** Creates the account (signed in straight away; email confirmation is off) and returns its id. */
export async function signUp(email: string, password: string, displayName: string) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data.user?.id;
}

export async function signIn(email: string, password: string) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}
