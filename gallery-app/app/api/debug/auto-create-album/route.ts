import { NextResponse } from "next/server";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupabaseError = { code?: string; message?: string; details?: string; hint?: string };

export async function GET() {
  const userId = await getGallerySession();
  console.log("[AUTO_CREATE_ALBUM_API] userId:", userId ?? "(null)");

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "No session", details: null, hint: null } },
      { status: 401 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("gallery_albums")
    .insert({
      owner_id: userId,
      name: "Galerija",
      description: null,
    })
    .select("id")
    .single();

  if (error) {
    const errDetails: SupabaseError = {
      code: (error as SupabaseError)?.code,
      message: (error as SupabaseError)?.message,
      details: (error as SupabaseError)?.details,
      hint: (error as SupabaseError)?.hint,
    };
    console.log("[AUTO_CREATE_ALBUM_API] result: fail", JSON.stringify(errDetails, null, 2));
    return NextResponse.json({ ok: false, error: errDetails }, { status: 500 });
  }

  const albumId = data?.id ?? null;
  if (!albumId) {
    console.log("[AUTO_CREATE_ALBUM_API] result: fail - No id returned");
    return NextResponse.json(
      { ok: false, error: { code: "no_id", message: "No id returned", details: null, hint: null } },
      { status: 500 }
    );
  }

  console.log("[AUTO_CREATE_ALBUM_API] result: success", { albumId });
  return NextResponse.json({ ok: true, albumId });
}
