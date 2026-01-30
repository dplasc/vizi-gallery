import { cookies } from "next/headers";

const GALLERY_SESSION_COOKIE = "gallery_session";

/** Get the gallery session user_id from cookie. Returns null if missing. */
export async function getGallerySession(): Promise<string | null> {
  const store = await cookies();
  const cookie = store.get(GALLERY_SESSION_COOKIE);
  const value = cookie?.value?.trim();
  return value || null;
}
