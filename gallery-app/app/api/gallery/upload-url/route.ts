import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";

function getExtFromFilename(filename: string): string | null {
  if (typeof filename !== "string" || !filename.trim()) return null;
  const last = filename.trim().split(/[/\\]/).pop();
  if (!last) return null;
  const idx = last.lastIndexOf(".");
  if (idx <= 0 || idx >= last.length - 1) return null;
  return last.slice(idx + 1).toLowerCase();
}

function getExtFromContentType(contentType: string): string | null {
  if (typeof contentType !== "string") return null;
  const m = contentType.trim().toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  let body: {
    album_id?: string;
    filename?: string;
    content_type?: string;
    size_bytes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const albumId =
    typeof body.album_id === "string" ? body.album_id.trim() : null;
  const filename =
    typeof body.filename === "string" ? body.filename.trim() : null;
  const contentType =
    typeof body.content_type === "string" ? body.content_type.trim() : null;
  const sizeBytes =
    typeof body.size_bytes === "number" && Number.isFinite(body.size_bytes)
      ? body.size_bytes
      : null;

  if (!albumId || !filename) {
    return NextResponse.json(
      { error: "album_id and filename are required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  // TODO: quota check

  const { data: album, error: albumError } = await supabase
    .from("gallery_albums")
    .select("id, owner_id")
    .eq("id", albumId)
    .maybeSingle();

  if (albumError) {
    console.error("Gallery album lookup failed:", albumError);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
  if (!album || album.owner_id !== userId) {
    return NextResponse.json(
      { error: "Album not found or access denied" },
      { status: 403 }
    );
  }

  let ext =
    getExtFromFilename(filename) ||
    (contentType ? getExtFromContentType(contentType) : null);
  if (!ext) ext = "bin";

  const imageId = crypto.randomUUID();
  const path = `${userId}/${albumId}/${imageId}.${ext}`;

  // createSignedUploadUrl uses server-defined expiry (e.g. 2h); 60s not configurable in API
  const { data: signData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (signError) {
    console.error("Create signed upload URL failed:", signError);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
  if (!signData?.signedUrl || !signData?.path) {
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    signedUrl: signData.signedUrl,
    path: signData.path,
  });
}
