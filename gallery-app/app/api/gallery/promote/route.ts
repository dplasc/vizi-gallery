import { NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

export async function POST(request: Request) {
  try {
    const ownerId = await getGallerySession();
    if (!ownerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const tempPath =
      typeof body.tempPath === "string" ? body.tempPath.trim() : "";
    const albumId =
      typeof body.albumId === "string" ? body.albumId.trim() : "";
    if (!tempPath || !albumId) {
      return NextResponse.json(
        { error: "tempPath and albumId are required" },
        { status: 400 }
      );
    }
    const sizeBytes =
      typeof body.sizeBytes === "number" && body.sizeBytes >= 0
        ? body.sizeBytes
        : typeof body.size_bytes === "number" && body.size_bytes >= 0
          ? body.size_bytes
          : 0;
    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : null;
    const expectedTempPrefix = `${ownerId}/temp/`;
    if (!tempPath.startsWith(expectedTempPrefix)) {
      return NextResponse.json(
        { error: "tempPath must start with {ownerId}/temp/" },
        { status: 400 }
      );
    }

    const filename = tempPath.replace(/^.*\//, "") || "file";
    const fromPath = tempPath.startsWith("/") ? tempPath.slice(1) : tempPath;
    const toPath = `${ownerId}/${albumId}/${filename}`;

    const admin = createSupabaseAdminClient();
    const { error: copyError } = await admin.storage
      .from(BUCKET)
      .copy(fromPath, toPath);

    if (copyError) {
      console.error("Gallery promote copy failed:", copyError);
      return NextResponse.json(
        { error: copyError.message || "Storage error" },
        { status: 500 }
      );
    }

    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove([fromPath]);

    if (removeError) {
      console.error("Gallery promote remove temp failed:", removeError);
      return NextResponse.json(
        { error: removeError.message || "Storage error" },
        { status: 500 }
      );
    }

    const { data: row, error: insertError } = await admin
      .from("gallery_images")
      .insert({
        owner_id: ownerId,
        album_id: albumId,
        storage_key_original: toPath,
        storage_key_optimized: toPath,
        storage_key_thumb: null,
        mime_type: contentType ?? "application/octet-stream",
        width: 0,
        height: 0,
        size_bytes_original: sizeBytes,
        size_bytes_optimized: sizeBytes,
        size_bytes: sizeBytes,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Gallery promote insert failed:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Database error" },
        { status: 500 }
      );
    }

    if (!row?.id) {
      return NextResponse.json(
        { error: "Failed to create image record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      finalPath: toPath,
      imageId: row.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gallery promote error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405 }
  );
}
