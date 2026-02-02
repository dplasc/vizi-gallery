import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/get-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST: Insert a gallery_images row after a successful storage upload.
 * Same table/columns as album images query: gallery_images (owner_id, album_id, path).
 * Auth: getUser() (same as album page); service role client for insert (same as promote).
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

    const admin = createSupabaseAdminClient();
    const { data: row, error: insertError } = await admin
      .from("gallery_images")
      .insert({
        owner_id: user.id,
        album_id: albumId,
        path: storagePath,
      })
      .select("id, owner_id, album_id, path")
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
