import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

function sanitizeFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").trim() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function randomHex(length = 16): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error (missing Supabase env)" },
        { status: 500 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const filename =
      typeof body.filename === "string" ? body.filename.trim() : "";
    const contentType =
      (typeof body.contentType === "string" ? body.contentType.trim() : "") ||
      (typeof body.content_type === "string" ? (body.content_type as string).trim() : "");
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    const ownerId =
      typeof body.ownerId === "string"
        ? body.ownerId.trim() || undefined
        : typeof body.owner_id === "string"
          ? body.owner_id.trim() || undefined
          : undefined;
    const albumId =
      typeof body.albumId === "string"
        ? body.albumId.trim() || undefined
        : typeof body.album_id === "string"
          ? body.album_id.trim() || undefined
          : undefined;

    if (!ownerId) {
      return NextResponse.json(
        { error: "ownerId is required" },
        { status: 400 }
      );
    }

    const rawSize =
      body.fileSize ?? body.file_size ?? body.size_bytes;
    const sizeNum =
      typeof rawSize === "number"
        ? rawSize
        : typeof rawSize === "string"
          ? Number(rawSize)
          : Number.NaN;
    if (
      !Number.isFinite(sizeNum) ||
      sizeNum < 1 ||
      !Number.isInteger(sizeNum)
    ) {
      return NextResponse.json(
        { error: "fileSize is required" },
        { status: 400 }
      );
    }
    const fileSize = sizeNum;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: canUpload, error: canErr } = await supabase.rpc(
      "can_user_upload",
      { p_owner_id: ownerId, p_new_file_size: fileSize }
    );
    if (canErr) {
      return NextResponse.json(
        { error: canErr.message || "Quota check failed" },
        { status: 500 }
      );
    }
    if (canUpload !== true) {
      return NextResponse.json(
        { error: "quota_exceeded" },
        { status: 403 }
      );
    }

    const sanitized = sanitizeFilename(filename);
    const path = albumId
      ? `${ownerId}/albums/${albumId}/${randomHex()}_${sanitized}`
      : `${ownerId}/temp/${randomHex()}_${sanitized}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Storage error" },
        { status: 500 }
      );
    }
    if (!data?.signedUrl || !data?.path) {
      return NextResponse.json(
        { error: "Failed to create signed upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: data.path,
      bucket: BUCKET,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
