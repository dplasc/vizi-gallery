import { NextRequest, NextResponse } from "next/server";
import { getViziBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const GALLERY_SESSION_COOKIE = "gallery_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function invalidResponse(request: NextRequest, redirectToSso: boolean) {
  if (redirectToSso) {
    return NextResponse.redirect(new URL("/sso?error=invalid", request.url), 302);
  }
  return NextResponse.json(
    { error: "Invalid or expired token" },
    { status: 401 }
  );
}

/**
 * POST /api/session
 * Body: JSON { token: string } or form field token=...
 * Verifies token with Vizi, sets gallery_session cookie on success, redirects or returns 401.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let token: string | null = null;

  const isFormSubmit = contentType.includes("application/x-www-form-urlencoded");

  if (contentType.includes("application/json")) {
    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return invalidResponse(request, isFormSubmit);
    }
    token = typeof body?.token === "string" ? body.token.trim() : null;
  } else {
    const formData = await request.formData();
    const raw = formData.get("token");
    token = typeof raw === "string" ? raw.trim() : null;
  }

  if (!token) {
    return invalidResponse(request, isFormSubmit);
  }

  const viziBase = getViziBaseUrl();
  const verifyUrl = `${viziBase}/api/gallery/sso/verify`;

  let res: Response;
  try {
    res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("Gallery session verify request failed:", err);
    return invalidResponse(request, isFormSubmit);
  }

  if (!res.ok) {
    return invalidResponse(request, isFormSubmit);
  }

  let data: { user_id?: string };
  try {
    data = await res.json();
  } catch {
    return invalidResponse(request, isFormSubmit);
  }

  const userId = data.user_id;
  if (!userId || typeof userId !== "string") {
    return invalidResponse(request, isFormSubmit);
  }

  const redirectResponse = NextResponse.redirect(
    new URL("/albums", request.url),
    302
  );
  redirectResponse.cookies.set(GALLERY_SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return redirectResponse;
}
