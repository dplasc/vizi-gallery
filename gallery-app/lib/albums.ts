import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CreateAlbumResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Inserts a gallery album for the given owner. Shared by POST /api/albums and
 * the owner albums page (e.g. auto-create default album). Caller is responsible
 * for validation (name length, etc.).
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
    const errMsg = [error.code, error.message].filter(Boolean).join(": ") || "Unknown error";
    // [AUTO_CREATE_ALBUM] Temporary: capture full Supabase error for debugging
    const errDetails = {
      code: (error as { code?: string })?.code,
      message: (error as { message?: string })?.message,
      details: (error as { details?: string })?.details,
      hint: (error as { hint?: string })?.hint,
    };
    console.error("[AUTO_CREATE_ALBUM] Gallery album insert failed:", JSON.stringify(errDetails, null, 2), "| raw:", error);
    return { ok: false, error: errMsg };
  }
  return data?.id != null ? { ok: true, id: data.id } : { ok: false, error: "No id returned" };
}
