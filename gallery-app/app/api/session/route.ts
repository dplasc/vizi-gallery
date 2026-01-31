import { NextRequest, NextResponse } from "next/server";
import { getViziBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const GALLERY_SESSION_COOKIE = "gallery_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function invalidResponse(
  redirectToSso: boolean,
  redirectTo: (path: string) => NextResponse
) {
  if (redirectToSso) {
    return redirectTo("/sso?error=invalid");
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
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const origin = `${proto}://${host}`;
  function redirectTo(path: string) {
    return NextResponse.redirect(new URL(path, origin), 302);
  }
  console.log("[api/session] redirect origin", {
    origin,
    url: request.url,
    xfHost: request.headers.get("x-forwarded-host"),
    xfProto: request.headers.get("x-forwarded-proto"),
  });

  const contentType = request.headers.get("content-type") ?? "";
  let token: string | null = null;

  const isFormSubmit = contentType.includes("application/x-www-form-urlencoded");

  if (contentType.includes("application/json")) {
    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return invalidResponse(isFormSubmit, redirectTo);
    }
    token = typeof body?.token === "string" ? body.token.trim() : null;
  } else {
    const formData = await request.formData();
    const raw = formData.get("token");
    token = typeof raw === "string" ? raw.trim() : null;
  }

  if (!token) {
    return invalidResponse(isFormSubmit, redirectTo);
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
    return invalidResponse(isFormSubmit, redirectTo);
  }

  if (!res.ok) {
    return invalidResponse(isFormSubmit, redirectTo);
  }

  let data: { user_id?: string };
  try {
    data = await res.json();
  } catch {
    return invalidResponse(isFormSubmit, redirectTo);
  }

  const userId = data.user_id;
  if (!userId || typeof userId !== "string") {
    return invalidResponse(isFormSubmit, redirectTo);
  }

  const redirectResponse = redirectTo("/albums");
  redirectResponse.cookies.set(GALLERY_SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });

  return redirectResponse;
}
