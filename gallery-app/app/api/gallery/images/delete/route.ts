import { NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

export async function POST(request: Request) {
  let imageId = "";
  try {
    const userId = await getGallerySession();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
    if (!imageId) {
      return NextResponse.json(
        { error: "imageId is required" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: image, error: fetchError } = await admin
      .from("gallery_images")
      .select("id, owner_id, storage_key_original, storage_key_optimized, storage_key_thumb")
      .eq("id", imageId)
      .maybeSingle();

    if (fetchError) {
      console.error("[delete-image] failure:", {
        message: fetchError.message,
        userId,
        imageId,
      });
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!image) {
      console.error("[delete-image] failure:", {
        message: "Image not found",
        userId,
        imageId,
      });
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.owner_id !== userId) {
      console.error("[delete-image] failure:", {
        message: "Forbidden: not owner",
        userId,
        imageId,
      });
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
        console.error("[delete-image] failure:", {
          message: storageError.message || "Storage delete failed",
          userId,
          imageId,
        });
        return NextResponse.json(
          { error: storageError.message || "Storage delete failed" },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await admin
      .from("gallery_images")
      .delete()
      .eq("id", imageId);

    if (deleteError) {
      console.error("[delete-image] failure:", {
        message: deleteError.message || "Failed to delete image record",
        userId,
        imageId,
      });
      return NextResponse.json(
        { error: "Failed to delete image record" },
        { status: 500 }
      );
    }

    console.log("[delete-image] image-deleted", { userId, imageId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[delete-image] failure:", {
      message,
      imageId: imageId || "unknown",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
