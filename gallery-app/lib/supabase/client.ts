"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for auth (PKCE, cookie-based session).
 * Use in client components for signInWithOtp etc. Session is synced to cookies for server-side getUser().
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  return createBrowserClient(url, anonKey);
}
