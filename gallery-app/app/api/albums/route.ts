import { NextRequest, NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { getViziBaseUrl } from "@/lib/config";
import { createAlbum } from "@/lib/albums";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;

/**
 * POST /api/albums
 * Body: form data with name (required), description (optional).
 * Requires gallery_session cookie. Inserts with owner_id = session user_id.
 * Redirects to /albums on success, /albums?error=... on error.
 */
export async function POST(request: NextRequest) {
  const userId = await getGallerySession();
  if (!userId) {
    const viziBase = getViziBaseUrl();
    return NextResponse.redirect(`${viziBase}/app`, 302);
  }

  let name: string;
  let description: string | null = null;

  try {
    const formData = await request.formData();
    const rawName = formData.get("name");
    name = typeof rawName === "string" ? rawName.trim() : "";
    const rawDesc = formData.get("description");
    description =
      typeof rawDesc === "string" && rawDesc.trim() ? rawDesc.trim() : null;
  } catch {
    return NextResponse.redirect(
      new URL("/albums?error=invalid", request.url),
      302
    );
  }

  if (!name) {
    return NextResponse.redirect(
      new URL("/albums?error=name_required", request.url),
      302
    );
  }

  if (name.length > NAME_MAX_LENGTH) {
    return NextResponse.redirect(
      new URL(
        `/albums?error=name_too_long&max=${NAME_MAX_LENGTH}`,
        request.url
      ),
      302
    );
  }

  if (description && description.length > DESCRIPTION_MAX_LENGTH) {
    return NextResponse.redirect(
      new URL("/albums?error=description_too_long", request.url),
      302
    );
  }

  // Dedupe: if album with same owner_id and name exists, return existing id (prevents double-submit duplicates).
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("gallery_albums")
    .select("id")
    .eq("owner_id", userId)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const wantsJson = request.headers.get("accept")?.includes("application/json");
    if (wantsJson) {
      return NextResponse.json({ id: existing.id }, { status: 200 });
    }
    return NextResponse.redirect(new URL("/albums", request.url), 302);
  }

  const result = await createAlbum(userId, name, description);
  const wantsJson = request.headers.get("accept")?.includes("application/json");

  if (!result) {
    if (wantsJson) {
      return NextResponse.json(
        { error: "create_failed" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(
      new URL("/albums?error=create_failed", request.url),
      302
    );
  }

  if (wantsJson) {
    return NextResponse.json({ id: result.id }, { status: 201 });
  }
  return NextResponse.redirect(new URL("/albums", request.url), 302);
}
