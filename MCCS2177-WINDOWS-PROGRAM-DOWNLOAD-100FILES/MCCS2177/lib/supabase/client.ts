import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_PROJECT_URL = "https://pzxslfhezmubslqqirao.supabase.co";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_PROJECT_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "MCCS authentication needs the Supabase Publishable Key in Vercel. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, apply it to Production, then redeploy."
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}
