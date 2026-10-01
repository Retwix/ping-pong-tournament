/// <reference types="vite/client" />
/// <reference types="@vitest/browser/providers/playwright" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string
