import { NextRequest, NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { getViziBaseUrl } from "@/lib/config";
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

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("gallery_albums").insert({
    owner_id: userId,
    name,
    description: description ?? null,
  });

  if (error) {
    console.error("Gallery album insert failed:", error);
    return NextResponse.redirect(
      new URL("/albums?error=create_failed", request.url),
      302
    );
  }

  return NextResponse.redirect(new URL("/albums", request.url), 302);
}
