import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST: Insert a gallery_images row after a successful storage upload.
 * Table: gallery_images (owner_id, album_id, storage_key_*, mime_type, dimensions, size_bytes_*).
 * Auth: getUser(); service role client for insert.
 */
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const albumId =
      typeof body.albumId === "string" ? body.albumId.trim() : "";
    const storagePath =
      typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    if (!albumId || !storagePath) {
      return NextResponse.json(
        { error: "albumId and storagePath are required" },
        { status: 400 }
      );
    }

    const contentType =
      typeof body.contentType === "string" ? body.contentType.trim() : null;
    const sizeBytes =
      typeof body.sizeBytes === "number" && body.sizeBytes >= 0
        ? body.sizeBytes
        : 0;

    const admin = createSupabaseAdminClient();
    const { data: row, error: insertError } = await admin
      .from("gallery_images")
      .insert({
        owner_id: user.id,
        album_id: albumId,
        storage_key_original: storagePath,
        storage_key_optimized: storagePath,
        storage_key_thumb: null,
        mime_type: contentType ?? "application/octet-stream",
        width: 0,
        height: 0,
        size_bytes_original: sizeBytes,
        size_bytes_optimized: sizeBytes,
        size_bytes: sizeBytes,
      })
      .select("id, storage_key_original")
      .single();

    if (insertError) {
      console.error("Gallery images insert failed:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Database error" },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        { error: "Failed to create image record" },
        { status: 500 }
      );
    }

    return NextResponse.json(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Gallery images POST error:", message);
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
