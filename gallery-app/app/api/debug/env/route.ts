import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY DEBUG ONLY — delete this route after confirming env vars at runtime.
 * GET /api/debug/env
 * Returns whether GALLERY_SSO_VERIFY_SECRET and VIZI_BASE_URL are present (never the secret value).
 */
export async function GET() {
  const gallerySsoVerifySecret = process.env.GALLERY_SSO_VERIFY_SECRET?.trim();
  const viziBaseUrl = process.env.VIZI_BASE_URL?.trim() ?? null;

  return NextResponse.json({
    ok: true,
    hasGallerySsoVerifySecret: Boolean(gallerySsoVerifySecret),
    gallerySsoVerifySecretLength: gallerySsoVerifySecret?.length ?? 0,
    hasViziBaseUrl: Boolean(viziBaseUrl),
    viziBaseUrl,
  });
}
