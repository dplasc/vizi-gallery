import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CreateAlbumResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const PG_UNIQUE_VIOLATION = "23505";

/**
 * Inserts a gallery album for the given owner. Shared by POST /api/albums and
 * the owner albums page (e.g. auto-create default album). Caller is responsible
 * for validation (name length, etc.).
 * Idempotent: on unique violation (23505) or no id returned, returns existing album id if found.
 */
export async function createAlbum(
  ownerId: string,
  name: string,
  description: string | null
): Promise<CreateAlbumResult> {
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
    if (error.code === PG_UNIQUE_VIOLATION) {
      const existing = await admin
        .from("gallery_albums")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("name", name)
        .limit(1)
        .maybeSingle();
      if (existing.data?.id) {
        return { ok: true, id: existing.data.id };
      }
    }
    const errMsg = [error.code, error.message].filter(Boolean).join(": ") || "Unknown error";
    return { ok: false, error: errMsg };
  }

  if (data?.id != null) {
    return { ok: true, id: data.id };
  }

  // Insert returned no id; try to find existing (e.g. race with another request)
  const existing = await admin
    .from("gallery_albums")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) {
    return { ok: true, id: existing.data.id };
  }
  return { ok: false, error: "No id returned" };
}
