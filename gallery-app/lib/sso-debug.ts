/**
 * SSO token debug utilities. Safe logging only (no full token).
 * Used for [gallery-sso] server logs and error categorization.
 */

export type TokenErrorCategory =
  | "MISSING_TOKEN"
  | "MALFORMED_TOKEN"
  | "EXPIRED_TOKEN"
  | "INVALID_SIGNATURE"
  | "UNKNOWN";

export interface TokenDebugInfo {
  length: number;
  first10: string;
  last10: string;
  exp: number | null;
  iat: number | null;
}

/**
 * Decodes JWT payload WITHOUT verifying signature. Safe for logging exp/iat.
 * Returns null if token is malformed (wrong format or invalid base64).
 */
export function decodeJwtPayloadUnsafe(token: string): {
  exp?: number;
  iat?: number;
} | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return {
      exp: typeof payload.exp === "number" ? payload.exp : undefined,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Builds safe debug info for logging (never log full token).
 */
export function getTokenDebugInfo(token: string): TokenDebugInfo {
  const decoded = decodeJwtPayloadUnsafe(token);
  const safeFirst = token.length >= 10 ? token.slice(0, 10) : token.slice(0);
  const safeLast = token.length >= 10 ? token.slice(-10) : "";

  return {
    length: token.length,
    first10: safeFirst,
    last10: safeLast,
    exp: decoded?.exp ?? null,
    iat: decoded?.iat ?? null,
  };
}

/**
 * Maps error message or Vizi API error to a stable category.
 * Use for logging and UI error display.
 */
export function categorizeTokenError(
  err: unknown,
  options?: { viziErrorBody?: string; decodedExp?: number | null }
): TokenErrorCategory {
  const msg =
    err instanceof Error ? err.message : String(err ?? "").toLowerCase();
  const lower = msg.toLowerCase();

  if (lower.includes("jwt expired") || lower.includes("token expired")) {
    return "EXPIRED_TOKEN";
  }
  if (
    lower.includes("invalid signature") ||
    lower.includes("signature verification failed")
  ) {
    return "INVALID_SIGNATURE";
  }
  if (
    lower.includes("jwt malformed") ||
    lower.includes("invalid token") ||
    lower.includes("invalid payload")
  ) {
    return "MALFORMED_TOKEN";
  }
  if (lower.includes("missing") || lower.includes("no token")) {
    return "MISSING_TOKEN";
  }

  // If Vizi returned an error body, try to categorize from that
  if (options?.viziErrorBody) {
    const body = options.viziErrorBody.toLowerCase();
    if (body.includes("expired")) return "EXPIRED_TOKEN";
    if (body.includes("signature")) return "INVALID_SIGNATURE";
    if (body.includes("malformed") || body.includes("invalid token"))
      return "MALFORMED_TOKEN";
  }

  // Fallback: if we decoded exp and it's in the past, likely expired
  if (
    options?.decodedExp != null &&
    typeof options.decodedExp === "number" &&
    options.decodedExp < Date.now() / 1000
  ) {
    return "EXPIRED_TOKEN";
  }

  return "UNKNOWN";
}
