import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return { url, key };
}

export async function createClient() {
  const { url, key } = getSupabaseConfig();

  // Returning null here keeps Vercel's build/prerender phase from crashing.
  // Authenticated pages redirect to /login?config=missing until variables exist.
  if (!url || !key) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Safe when called from a Server Component where cookies are read-only.
        }
      },
    },
  });
}

export function getServerSupabaseConfigStatus() {
  const { url, key } = getSupabaseConfig();
  return {
    configured: Boolean(url && key),
    hasUrl: Boolean(url),
    hasKey: Boolean(key),
  };
}
