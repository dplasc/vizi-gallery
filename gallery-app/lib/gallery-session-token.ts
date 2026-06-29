import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = "v1";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SessionPayload {
  uid: string;
  exp: number;
}

function getSecretOrThrow(): string {
  const secret = process.env.GALLERY_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("GALLERY_SESSION_SECRET is missing or empty");
  }
  return secret;
}

function base64UrlEncode(data: string | Buffer): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Buffer | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    return Buffer.from(base64 + "=".repeat(padLen), "base64");
  } catch {
    return null;
  }
}

function signPayload(payloadB64: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${TOKEN_VERSION}.${payloadB64}`);
  return base64UrlEncode(hmac.digest());
}

function isValidUid(uid: string): boolean {
  return UUID_REGEX.test(uid);
}

export function createGallerySessionToken(userId: string): string {
  const secret = getSecretOrThrow();
  const uid = userId.trim();
  if (!uid || !isValidUid(uid)) {
    throw new Error("Invalid user id for gallery session token");
  }

  const payload: SessionPayload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadB64, secret);
  return `${TOKEN_VERSION}.${payloadB64}.${signature}`;
}

export function verifyGallerySessionToken(token: string): string | null {
  const secret = process.env.GALLERY_SESSION_SECRET?.trim();
  if (!secret) {
    return null;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  const payloadB64 = parts[1];
  const signatureB64 = parts[2];
  if (!payloadB64 || !signatureB64) {
    return null;
  }

  const expectedSignature = signPayload(payloadB64, secret);
  const signatureBuf = base64UrlDecode(signatureB64);
  const expectedBuf = base64UrlDecode(expectedSignature);
  if (!signatureBuf || !expectedBuf || signatureBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const payloadBuf = base64UrlDecode(payloadB64);
  if (!payloadBuf) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadBuf.toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.uid !== "string" ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return null;
  }

  const uid = payload.uid.trim();
  if (!uid || !isValidUid(uid)) {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return uid;
}
