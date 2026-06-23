import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";
const SIGNED_URL_TTL_SECONDS = 600;
const PREVIEW_LIMIT = 4;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

function jsonWithCache(
  body: Record<string, unknown>,
  status: number,
  cache: boolean
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: cache ? { "Cache-Control": CACHE_CONTROL } : undefined,
  });
}

/**
 * GET /api/public/preview/[username]
 * Public read-only preview of up to 4 gallery thumbnails for a Vizi profile username.
 * No auth. Does not expose storage keys, owner_id, or album_id.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawParam } = await context.params;
    const username = normalizeUsername(
      typeof rawParam === "string" ? decodeURIComponent(rawParam) : ""
    );

    if (!username) {
      return jsonWithCache(
        { ok: false, error: "profile_not_found", images: [] },
        404,
        false
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return jsonWithCache(
        { ok: false, error: "profile_not_found", images: [] },
        404,
        false
      );
    }

    const ownerId = profile.id;

    const { data: albumRows, error: albumsError } = await admin
      .from("gallery_albums")
      .select("id")
      .eq("owner_id", ownerId);

    if (albumsError) {
      console.error("[public/preview] gallery_albums error:", albumsError);
      return NextResponse.json(
        { ok: false, error: "internal_error", images: [] },
        { status: 500 }
      );
    }

    const albumIds = (albumRows ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (albumIds.length === 0) {
      return jsonWithCache({ ok: true, images: [] }, 200, true);
    }

    const { data: imageRows, error: imagesError } = await admin
      .from("gallery_images")
      .select("id, storage_key_thumb, album_id")
      .eq("owner_id", ownerId)
      .in("album_id", albumIds)
      .not("storage_key_thumb", "is", null)
      .order("id", { ascending: false })
      .limit(PREVIEW_LIMIT);

    if (imagesError) {
      console.error("[public/preview] gallery_images error:", imagesError);
      return NextResponse.json(
        { ok: false, error: "internal_error", images: [] },
        { status: 500 }
      );
    }

    const rows = (imageRows ?? []).filter(
      (row): row is { id: string; storage_key_thumb: string; album_id: string } =>
        typeof row.id === "string" &&
        typeof row.storage_key_thumb === "string" &&
        row.storage_key_thumb.trim().length > 0 &&
        typeof row.album_id === "string" &&
        albumIds.includes(row.album_id)
    );

    if (rows.length === 0) {
      return jsonWithCache({ ok: true, images: [] }, 200, true);
    }

    const thumbKeys = rows.map((row) => row.storage_key_thumb.trim());
    const { data: signedData, error: signError } = await admin.storage
      .from(GALLERY_BUCKET)
      .createSignedUrls(thumbKeys, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.error("[public/preview] signed URL error:", signError);
      return NextResponse.json(
        { ok: false, error: "internal_error", images: [] },
        { status: 500 }
      );
    }

    const keyToUrl = new Map<string, string>();
    for (const item of signedData ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        keyToUrl.set(item.path, item.signedUrl);
      }
    }

    const images = rows
      .map((row) => {
        const thumbUrl = keyToUrl.get(row.storage_key_thumb.trim());
        if (!thumbUrl) return null;
        return {
          id: row.id,
          thumbUrl,
          alt: "Galerija slika",
        };
      })
      .filter((item): item is { id: string; thumbUrl: string; alt: string } =>
        item !== null
      );

    return jsonWithCache({ ok: true, images }, 200, true);
  } catch (err) {
    console.error("[public/preview] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", images: [] },
      { status: 500 }
    );
  }
}
