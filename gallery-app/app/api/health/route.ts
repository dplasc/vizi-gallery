import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/health
 * Lightweight healthcheck for uptime monitoring.
 * No DB, auth, or external dependencies.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "vizi-gallery",
    ts: new Date().toISOString(),
  });
}
