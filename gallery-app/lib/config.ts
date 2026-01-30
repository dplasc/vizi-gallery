/** Base URL of the main Vizi app. Used for SSO verify and redirect links. */
export function getViziBaseUrl(): string {
  const url = process.env.VIZI_BASE_URL?.trim();
  if (url) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }
  return "https://www.vizi.hr";
}
