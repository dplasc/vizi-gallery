import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { imageId } = await params;
    if (!imageId?.trim()) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: image, error: fetchError } = await admin
      .from("gallery_images")
      .select("id, owner_id, storage_key_original, storage_key_optimized, storage_key_thumb")
      .eq("id", imageId.trim())
      .maybeSingle();

    if (fetchError) {
      console.error("[DELETE image] fetch error:", fetchError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const keysToRemove: string[] = [];
    if (image.storage_key_original?.trim()) {
      keysToRemove.push(image.storage_key_original.trim());
    }
    if (
      image.storage_key_optimized?.trim() &&
      image.storage_key_optimized.trim() !== image.storage_key_original?.trim()
    ) {
      keysToRemove.push(image.storage_key_optimized.trim());
    }
    if (image.storage_key_thumb?.trim()) {
      keysToRemove.push(image.storage_key_thumb.trim());
    }

    if (keysToRemove.length > 0) {
      const { error: storageError } = await admin.storage
        .from(BUCKET)
        .remove(keysToRemove);

      if (storageError) {
        console.error("[DELETE image] storage remove error:", storageError);
        return NextResponse.json(
          { error: storageError.message || "Storage delete failed" },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await admin
      .from("gallery_images")
      .delete()
      .eq("id", imageId.trim());

    if (deleteError) {
      console.error("[DELETE image] db delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete image record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE image] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
