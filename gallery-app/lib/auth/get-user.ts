import { createSupabaseServerClient } from "@/lib/supabase/server";

export type User = { id: string };

/**
 * Returns the signed-in user from Supabase Auth (server-side), or null.
 * Uses supabase.auth.getUser() with the server Supabase client (cookie-based session).
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return null;
  return { id: user.id };
}
