import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";
const MAX_PREVIEW_IMAGES = 4;
const SIGNED_URL_TTL_SECONDS = 60 * 10;

function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

type PreviewImageRow = {
  id: string;
  storage_key_original: string | null;
  storage_key_optimized: string | null;
  storage_key_thumb: string | null;
};

function resolveThumbStorageKey(row: PreviewImageRow): string {
  return (
    row.storage_key_thumb?.trim() ||
    row.storage_key_optimized?.trim() ||
    row.storage_key_original?.trim() ||
    ""
  );
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/public/preview/[username]
 * Public read-only preview for Vizi core public profiles. No auth required.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await context.params;
    const username = normalizeUsername(rawUsername ?? "");
    if (!username) {
      return jsonResponse({ ok: true, images: [] });
    }

    const admin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profileError) {
      console.error("[public/preview] profile lookup failed:", profileError);
      return jsonResponse({ ok: false, error: "preview_failed" }, 500);
    }

    if (!profile) {
      return jsonResponse({ ok: true, images: [] });
    }

    const ownerId = profile.id;

    const { data: albums, error: albumsError } = await admin
      .from("gallery_albums")
      .select("id, name, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (albumsError) {
      console.error("[public/preview] albums lookup failed:", albumsError);
      return jsonResponse({ ok: false, error: "preview_failed" }, 500);
    }

    const albumList = albums ?? [];
    if (albumList.length === 0) {
      return jsonResponse({ ok: true, images: [] });
    }

    const defaultAlbum = albumList.find((a) => a.name === "Galerija");
    const albumIds = albumList.map((a) => a.id);

    let imageRows: PreviewImageRow[] = [];

    if (defaultAlbum) {
      const { data, error } = await admin
        .from("gallery_images")
        .select(
          "id, storage_key_original, storage_key_optimized, storage_key_thumb"
        )
        .eq("owner_id", ownerId)
        .eq("album_id", defaultAlbum.id)
        .order("id", { ascending: false })
        .limit(MAX_PREVIEW_IMAGES);

      if (error) {
        console.error("[public/preview] default album images failed:", error);
        return jsonResponse({ ok: false, error: "preview_failed" }, 500);
      }

      imageRows = data ?? [];
    }

    if (imageRows.length === 0) {
      const { data, error } = await admin
        .from("gallery_images")
        .select(
          "id, storage_key_original, storage_key_optimized, storage_key_thumb"
        )
        .eq("owner_id", ownerId)
        .in("album_id", albumIds)
        .order("id", { ascending: false })
        .limit(MAX_PREVIEW_IMAGES);

      if (error) {
        console.error("[public/preview] images lookup failed:", error);
        return jsonResponse({ ok: false, error: "preview_failed" }, 500);
      }

      imageRows = data ?? [];
    }

    if (imageRows.length === 0) {
      return jsonResponse({ ok: true, images: [] });
    }

    const thumbKeys = [
      ...new Set(
        imageRows
          .map(resolveThumbStorageKey)
          .filter((key): key is string => Boolean(key))
      ),
    ];

    const keyToUrl = new Map<string, string>();
    if (thumbKeys.length > 0) {
      const { data: signedData, error: signError } = await admin.storage
        .from(GALLERY_BUCKET)
        .createSignedUrls(thumbKeys, SIGNED_URL_TTL_SECONDS);

      if (signError) {
        console.error("[public/preview] signed URL generation failed:", signError);
        return jsonResponse({ ok: false, error: "preview_failed" }, 500);
      }

      for (const item of signedData ?? []) {
        if (item.path && item.signedUrl) {
          keyToUrl.set(item.path, item.signedUrl);
        }
      }
    }

    const images = imageRows
      .map((row) => {
        const thumbKey = resolveThumbStorageKey(row);
        const thumbUrl = thumbKey ? keyToUrl.get(thumbKey) : undefined;
        if (!thumbUrl) return null;
        return { id: row.id, thumbUrl };
      })
      .filter((item): item is { id: string; thumbUrl: string } => item !== null);

    return jsonResponse({ ok: true, images });
  } catch (err) {
    console.error("[public/preview] unexpected error:", err);
    return jsonResponse({ ok: false, error: "preview_failed" }, 500);
  }
}
