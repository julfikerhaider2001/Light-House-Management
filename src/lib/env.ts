import * as z from 'zod/mini';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.optional(z.url()),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.optional(z.string().check(z.minLength(1))),
});

const parsed = EnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined,
});

export const env = {
  supabaseUrl: parsed.VITE_SUPABASE_URL,
  supabasePublishableKey: parsed.VITE_SUPABASE_PUBLISHABLE_KEY,
  appVersion: __APP_VERSION__,
  builtAt: __BUILT_AT__,
} as const;
