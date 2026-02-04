import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Inserts a gallery album for the given owner. Shared by POST /api/albums and
 * the owner albums page (e.g. auto-create default album). Caller is responsible
 * for validation (name length, etc.).
 *
 * @returns The inserted row's id, or null on failure.
 */
export async function createAlbum(
  ownerId: string,
  name: string,
  description: string | null
): Promise<{ id: string } | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("gallery_albums")
    .insert({
      owner_id: ownerId,
      name,
      description: description ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Gallery album insert failed:", error);
    return null;
  }
  return data?.id != null ? { id: data.id } : null;
}
