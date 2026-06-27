import { NextRequest, NextResponse } from "next/server";
import { getViziBaseUrl } from "@/lib/config";
import {
  type TokenErrorCategory,
  categorizeTokenError,
  getTokenDebugInfo,
  decodeJwtPayloadUnsafe,
} from "@/lib/sso-debug";

export const dynamic = "force-dynamic";

const GALLERY_SESSION_COOKIE = "gallery_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function invalidResponse(
  redirectToSso: boolean,
  redirectTo: (path: string) => NextResponse,
  category: TokenErrorCategory,
  reason: string
) {
  const resolvedCategory = category || "UNKNOWN";
  if (redirectToSso) {
    return redirectTo(
      `/sso?error=invalid&from=SESSION&category=${encodeURIComponent(resolvedCategory)}&reason=${encodeURIComponent(reason)}`
    );
  }
  return NextResponse.json(
    {
      error: `Invalid or expired token (${resolvedCategory})`,
      category: resolvedCategory,
      reason,
    },
    { status: 401 }
  );
}

/**
 * POST /api/session
 * Body: JSON { token: string } or form field token=...
 * Verifies token with Vizi, sets gallery_session cookie on success, redirects or returns 401.
 */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  function redirectTo(path: string) {
    return NextResponse.redirect(new URL(path, origin), 302);
  }
  console.log("[api/session] nextUrl.origin", origin);

  const contentType = request.headers.get("content-type") ?? "";
  let token: string | null = null;

  const isFormSubmit = contentType.includes("application/x-www-form-urlencoded");

  if (contentType.includes("application/json")) {
    let body: { token?: string };
    try {
      body = await request.json();
    } catch (parseErr) {
      console.error("[gallery-sso] JSON body parse failed:", parseErr);
      return invalidResponse(isFormSubmit, redirectTo, "UNKNOWN", "UNKNOWN_ERROR");
    }
    token = typeof body?.token === "string" ? body.token.trim() : null;
  } else {
    const formData = await request.formData();
    const raw = formData.get("token");
    token = typeof raw === "string" ? raw.trim() : null;
  }

  if (!token) {
    console.error("[gallery-sso] MISSING_TOKEN: no token in request");
    return invalidResponse(
      isFormSubmit,
      redirectTo,
      "MISSING_TOKEN",
      "MISSING_TOKEN"
    );
  }

  const debugInfo = getTokenDebugInfo(token);
  console.log(
    "[gallery-sso] token debug:",
    `len=${debugInfo.length}`,
    `first10=${debugInfo.first10}`,
    `last10=${debugInfo.last10}`,
    `exp=${debugInfo.exp ?? "null"}`,
    `iat=${debugInfo.iat ?? "null"}`
  );

  const verifySecret = process.env.GALLERY_SSO_VERIFY_SECRET?.trim();
  if (!verifySecret) {
    console.error(
      "[gallery-sso] GALLERY_SSO_VERIFY_SECRET is missing or empty; cannot verify token with Vizi"
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const viziBase = getViziBaseUrl();
  const verifyUrl = `${viziBase}/api/gallery/verify`;

  let res: Response;
  try {
    res = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gallery-SSO-Secret": verifySecret,
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch (err) {
    const category = categorizeTokenError(err, {
      decodedExp: debugInfo.exp,
    });
    console.error(
      "[gallery-sso] verify request failed:",
      "errName=",
      err instanceof Error ? err.name : "unknown",
      "errMessage=",
      err instanceof Error ? err.message : String(err),
      "category=",
      category
    );
    return invalidResponse(
      isFormSubmit,
      redirectTo,
      category,
      "VERIFY_FETCH_FAILED"
    );
  }

  let viziErrorBody = "";
  if (!res.ok) {
    try {
      viziErrorBody = await res.text();
    } catch {
      viziErrorBody = "";
    }
    const decoded = decodeJwtPayloadUnsafe(token);
    const category = categorizeTokenError(
      new Error(viziErrorBody || `HTTP ${res.status}`),
      {
        viziErrorBody,
        decodedExp: decoded?.exp ?? null,
      }
    );
    console.error(
      "[gallery-sso] verify failed:",
      "status=",
      res.status,
      "viziBody=",
      viziErrorBody?.slice(0, 200) ?? "(empty)",
      "category=",
      category
    );
    return invalidResponse(
      isFormSubmit,
      redirectTo,
      category,
      `VIZI_NON_OK_STATUS_${res.status}`
    );
  }

  let data: { user_id?: string };
  try {
    data = await res.json();
  } catch {
    console.error("[gallery-sso] Vizi response JSON parse failed");
    return invalidResponse(
      isFormSubmit,
      redirectTo,
      "UNKNOWN",
      "VIZI_JSON_PARSE_FAILED"
    );
  }

  const userId = data.user_id;
  if (!userId || typeof userId !== "string") {
    console.error("[gallery-sso] Vizi returned ok but no user_id");
    return invalidResponse(
      isFormSubmit,
      redirectTo,
      "UNKNOWN",
      "VIZI_MISSING_USER_ID"
    );
  }

  const redirectResponse = redirectTo("/albums");
  const isProduction = process.env.NODE_ENV === "production";
  redirectResponse.cookies.set(GALLERY_SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    domain: isProduction ? ".vizi.hr" : undefined,
    maxAge: MAX_AGE,
  });

  return redirectResponse;
}
