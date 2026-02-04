import { NextRequest, NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const userId = await getGallerySession();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { albumId } = await params;
    if (!albumId?.trim()) {
      return NextResponse.json({ error: "Album ID required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: album, error: albumError } = await admin
      .from("gallery_albums")
      .select("id, owner_id")
      .eq("id", albumId.trim())
      .maybeSingle();

    if (albumError) {
      console.error("[DELETE album] fetch album error:", albumError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.owner_id !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: images, error: imagesError } = await admin
      .from("gallery_images")
      .select("id, storage_key_original, storage_key_optimized")
      .eq("album_id", albumId.trim());

    if (imagesError) {
      console.error("[DELETE album] fetch images error:", imagesError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    const keysToRemove: string[] = [];
    const seen = new Set<string>();
    for (const img of images ?? []) {
      if (img.storage_key_original?.trim() && !seen.has(img.storage_key_original.trim())) {
        seen.add(img.storage_key_original.trim());
        keysToRemove.push(img.storage_key_original.trim());
      }
      if (
        img.storage_key_optimized?.trim() &&
        !seen.has(img.storage_key_optimized.trim())
      ) {
        seen.add(img.storage_key_optimized.trim());
        keysToRemove.push(img.storage_key_optimized.trim());
      }
    }

    if (keysToRemove.length > 0) {
      const { error: storageError } = await admin.storage
        .from(BUCKET)
        .remove(keysToRemove);

      if (storageError) {
        console.error("[DELETE album] storage remove error:", storageError);
        return NextResponse.json(
          { error: storageError.message || "Storage delete failed" },
          { status: 500 }
        );
      }
    }

    const imageIds = (images ?? []).map((i) => i.id);
    if (imageIds.length > 0) {
      const { error: deleteImagesError } = await admin
        .from("gallery_images")
        .delete()
        .in("id", imageIds);

      if (deleteImagesError) {
        console.error("[DELETE album] delete images error:", deleteImagesError);
        return NextResponse.json(
          { error: "Failed to delete image records" },
          { status: 500 }
        );
      }
    }

    const { error: deleteAlbumError } = await admin
      .from("gallery_albums")
      .delete()
      .eq("id", albumId.trim());

    if (deleteAlbumError) {
      console.error("[DELETE album] delete album error:", deleteAlbumError);
      return NextResponse.json(
        { error: "Failed to delete album" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedImages: imageIds.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE album] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
