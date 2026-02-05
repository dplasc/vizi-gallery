# gallery-app — Galerija Vizi.hr

MVP skeleton for galerija.vizi.hr. SSO flow + albums placeholder.

## Commands

```bash
# Install dependencies
npm install

# Run dev server on port 3001
npm run dev
```

Open http://localhost:3001

## Auth entry (how to log in locally)

- **Login (Supabase magic link, local dev):** [http://localhost:3001/login](http://localhost:3001/login) — Email + “Pošalji kod”; link in email completes sign-in and redirects to `/albums`. Use when `NEXT_PUBLIC_SUPABASE_*` is set.
- **SSO (production / Vizi):** [http://localhost:3001/sso?token=...](http://localhost:3001/sso) — Callback from main Vizi app; token must be issued by Vizi. No register/sign-up route in this app.

## Routes

- `/` — Redirects to /albums if logged in, else to Vizi app
- `/login` — Local login: email + “Pošalji kod” (Supabase OTP/magic link)
- `/sso?token=...` — SSO callback from Vizi (verify token, set cookie, redirect to /albums)
- `/albums` — Protected; shows "Moji albumi" empty state

## Config

Copy `.env.example` to `.env.local` and set `VIZI_BASE_URL` if needed (default: https://www.vizi.hr).

## Thumbnail pipeline (verification)

- **Upload:** Use a large phone photo (e.g. 4–12 MB). In the album upload card, click Upload; wait for "Optimizing image…" then "Dodano u album".
- **DB:** In Supabase `gallery_images`, confirm the new row has `storage_key_thumb` set to a path like `{ownerId}/{albumId}/{imageId}_thumb.jpg`.
- **Grid:** Open the album; in DevTools → Network, filter by "Img" or image requests. Grid tiles should load small thumb URLs (~250 KB or less); opening a image in the lightbox loads the full optimized/original URL.
- **Fallback:** Images uploaded before this feature (or if thumb generation/upload failed) have `storage_key_thumb` null; the grid falls back to optimized then original for the tile.
