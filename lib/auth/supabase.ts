// web/lib/auth/supabase.ts
"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Quick flag you can use anywhere to show/hide auth UI */
export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Returns a browser-only Supabase client or null if env is missing.
 * Never create during SSR.
 */
export function getSupa(): SupabaseClient | null {
  if (typeof window === "undefined") return null; // SSR guard
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Supabase] Missing",
        !url ? "NEXT_PUBLIC_SUPABASE_URL" : "",
        !anon ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "",
        "→ put them in web/.env.local and restart dev."
      );
    }
    return null;
  }

  cached = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}

/** Throw if Supabase isn’t configured (handy for protected pages). */
export function requireSupa(): SupabaseClient {
  const supa = getSupa();
  if (!supa) throw new Error("Auth not configured. Add Supabase env vars to enable this page.");
  return supa;
}

/** Convenience: get current access token or null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  const supa = getSupa();
  if (!supa) return null;
  const { data } = await supa.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Convenience: get current user (or null). */
export async function getCurrentUser(): Promise<User | null> {
  const supa = getSupa();
  if (!supa) return null;
  const { data } = await supa.auth.getUser();
  return data.user ?? null;
}
