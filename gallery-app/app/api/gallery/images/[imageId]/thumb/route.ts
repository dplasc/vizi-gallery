import { NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ imageId: string }> }
) {
  try {
    const sessionOwnerId = await getGallerySession();
    if (!sessionOwnerId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const { imageId: rawImageId } = await context.params;
    const imageId = typeof rawImageId === "string" ? rawImageId.trim() : "";
    if (!imageId) {
      return NextResponse.json(
        { ok: false, error: "invalid_image_id" },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400 }
      );
    }

    const thumbStoragePath =
      typeof body.thumbStoragePath === "string"
        ? body.thumbStoragePath.trim()
        : "";
    if (!thumbStoragePath) {
      return NextResponse.json(
        { ok: false, error: "invalid_thumb_storage_path" },
        { status: 400 }
      );
    }

    const expectedPrefix = `${sessionOwnerId}/`;
    if (
      !thumbStoragePath.startsWith(expectedPrefix) ||
      thumbStoragePath.includes("..")
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_thumb_storage_path" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: image, error: fetchError } = await admin
      .from("gallery_images")
      .select("id, owner_id")
      .eq("id", imageId)
      .maybeSingle();

    if (fetchError) {
      console.error("[PATCH image thumb] fetch error:", fetchError);
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { ok: false, error: "image_not_found" },
        { status: 404 }
      );
    }

    if (image.owner_id !== sessionOwnerId) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 }
      );
    }

    const { error: updateError } = await admin
      .from("gallery_images")
      .update({ storage_key_thumb: thumbStoragePath })
      .eq("id", imageId);

    if (updateError) {
      console.error("[PATCH image thumb] update error:", updateError);
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PATCH image thumb] error:", message);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
