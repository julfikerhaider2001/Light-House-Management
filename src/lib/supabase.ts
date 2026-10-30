import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { env } from './env';

export type Client = SupabaseClient<Database>;

/** False when the build has no Supabase env (e.g. the Lighthouse gate's static build). */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);

let client: Promise<Client> | undefined;

/**
 * supabase-js is loaded after first paint (its own chunk) so the shell renders without it.
 * Every caller shares one client.
 */
export function getSupabase(): Promise<Client> {
  const { supabaseUrl, supabasePublishableKey } = env;
  if (!supabaseUrl || !supabasePublishableKey) {
    return Promise.reject(new Error('Supabase is not configured for this build'));
  }
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    }),
  );
  return client;
}
