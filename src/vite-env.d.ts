/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILT_AT__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
