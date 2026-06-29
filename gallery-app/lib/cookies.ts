import { cookies } from "next/headers";
import { verifyGallerySessionToken } from "@/lib/gallery-session-token";

const GALLERY_SESSION_COOKIE = "gallery_session";

/** Get the gallery session user_id from cookie. Returns null if missing or invalid. */
export async function getGallerySession(): Promise<string | null> {
  const store = await cookies();
  const cookie = store.get(GALLERY_SESSION_COOKIE);
  const value = cookie?.value?.trim();
  if (!value) {
    return null;
  }
  return verifyGallerySessionToken(value);
}
