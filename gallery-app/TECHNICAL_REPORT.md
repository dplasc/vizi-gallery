# Gallery-App — Structured Technical Report

**Purpose:** Long-term project context for AI/developers. Describes the system as implemented in code. No speculation, no proposed features, no refactor suggestions.

---

## 1. Project purpose

- **What this application is:** A standalone Next.js app (MVP skeleton) for **galerija.vizi.hr** — a gallery feature for Vizi.hr users (albums, image uploads).
- **Why it exists separately:** It is a separate codebase from the main Vizi app. README states it is an "MVP skeleton" with "SSO flow + albums placeholder." The main app lives at `VIZI_BASE_URL` (e.g. https://www.vizi.hr); this app runs on port 3001.
- **What problem it solves:** Provides a dedicated gallery subdomain/app where users sign in via the main Vizi app (SSO), then manage albums and (eventually) images. Separation allows independent deployment and tech choices (Next.js, Supabase) while reusing Vizi identity.

---

## 2. Tech stack

- **Frameworks:** Next.js 16.1.3 (App Router), React 19.2.3, TypeScript 5.
- **Auth approach:** Custom SSO via main Vizi app. No Supabase Auth for normal flows. Token is verified by calling `{VIZI_BASE_URL}/api/gallery/sso/verify`; on success a `gallery_session` cookie is set with `user_id`. Session is cookie-only (no JWT in this app).
- **External services:**
  - **Supabase:** Postgres (tables `gallery_albums`, `gallery_images`) and Storage (bucket `gallery`). Server-side access uses **Service Role** key only; no RPC or SQL definitions live in this repo — they are assumed to exist in the Vizi Supabase project.
  - **Vizi main app:** SSO verification endpoint and redirect target for unauthenticated users.
- **Hosting assumptions:** Not specified in code. Dev runs on port 3001 (`next dev -p 3001`). Production would need `SUPABASE_*` and `VIZI_BASE_URL` set; no platform-specific config (Vercel, etc.) in repo.

---

## 3. Architecture overview

- **High-level structure:** Single Next.js App Router app. Server components and API routes; one client component (`app/upload-test/page.tsx`) for upload testing.
- **App Router layout:**
  - `app/layout.tsx` — root layout (html/lang=hr, dark theme).
  - `app/page.tsx` — home: redirect to `/albums` if session present, else redirect to `{VIZI_BASE_URL}/app`.
  - `app/albums/page.tsx` — list albums, create album form.
  - `app/albums/[id]/page.tsx` — album detail (placeholder for images).
  - `app/sso/page.tsx` — SSO callback UI (token in query, form POST to `/api/session`).
  - `app/upload-test/page.tsx` — dev/test upload UI (client-side).
- **Key folders:**
  - `app/api/` — API routes (session, albums, gallery/upload-url, gallery/promote).
  - `lib/` — config (`getViziBaseUrl`), cookies (`getGallerySession`), Supabase admin client.
  - `components/ui/` — shadcn-style UI (button, card, input, textarea).

---

## 4. Authentication & access control

- **How users are authenticated:** Via SSO from the main Vizi app. User arrives at `/sso?token=...`. SSO page renders a form that POSTs the token to `POST /api/session`. Session route POSTs the token to `{VIZI_BASE_URL}/api/gallery/sso/verify`; if the response contains `user_id`, it sets cookie `gallery_session=<user_id>`, 7-day max-age, httpOnly, secure in production, sameSite=lax, path=/. No login form or password in this app.
- **SSO flow:** 1) User gets token from main app. 2) User lands on `/sso?token=...`. 3) User submits form → POST `/api/session` with token. 4) App calls Vizi verify API; on success sets cookie and redirects to `/albums`. 5) Subsequent requests read `user_id` from `getGallerySession()` (cookie). If token is missing/invalid/expired, redirect to `/sso?error=invalid` (form) or 401 JSON (non-form).
- **Session handling:** Single cookie `gallery_session`; value is the Vizi `user_id` string. No refresh flow; when cookie is missing or not set, protected pages redirect to Vizi app or `/albums` (album detail redirects to `/albums` when no session).
- **If auth is missing:** Home redirects to `{VIZI_BASE_URL}/app`. `/albums` and `/albums/[id]` redirect to `{VIZI_BASE_URL}/app`. Album creation POST redirects to Vizi app. Promote API returns 401 JSON. Upload-URL API does **not** check session — it accepts `ownerId` in the request body (see Security model).

---

## 5. Gallery domain model

- **Albums:** Stored in `gallery_albums`. Used columns: `id`, `owner_id`, `name`, `description`, `created_at`. Insert via `POST /api/albums` with `owner_id` from session. List and detail filter by `owner_id` from session. Schema (columns, constraints, RLS) is **not** in this repo — assumed in Supabase.
- **Images:** Stored in `gallery_images`. Used columns: `id`, `owner_id`, `album_id`, `path`. Rows are created only in the promote flow (`POST /api/gallery/promote`) after moving a file from temp to final path. Schema not in repo.
- **Ownership model:** Strict per-user. All album and image operations are scoped by `owner_id`. Albums list and album detail enforce `owner_id === session user_id`. Promote uses session as `ownerId` and validates `tempPath` prefix `{ownerId}/temp/`.
- **Database tables involved:** `gallery_albums` (insert, select), `gallery_images` (insert). Supabase RPC `can_user_upload(p_owner_id, p_new_file_size)` is called from upload-url route; definition not in repo.

---

## 6. Upload flow (ACTUAL)

1. **Client** (e.g. upload-test page or any client) sends `POST /api/gallery/upload-url` with JSON: `filename`, `contentType` (or `content_type`), `ownerId` (or `owner_id`), optional `albumId`/`album_id`, `fileSize`/`file_size`/`size_bytes` (integer).
2. **upload-url route:** Validates body; uses `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` to create Supabase client. Calls RPC `can_user_upload(p_owner_id, p_new_file_size)`; if result is not `true`, returns 403 `quota_exceeded`. Builds storage path: if `albumId` then `{ownerId}/albums/{albumId}/{randomHex}_{sanitizedFilename}`, else `{ownerId}/temp/{randomHex}_{sanitizedFilename}`. Calls `supabase.storage.from("gallery").createSignedUploadUrl(path)` and returns JSON `{ signedUrl, path, bucket }`.
3. **Client** uploads file with `PUT` to `signedUrl`, body = file, `Content-Type` = file type.
4. **Promote (optional):** To attach a temp upload to an album, client calls `POST /api/gallery/promote` with JSON `{ tempPath, albumId }`. Requires `gallery_session` cookie. Route validates `tempPath.startsWith(ownerId + "/temp/")`. Copies object from `tempPath` to `{ownerId}/{albumId}/{filename}` (note: no `albums` segment in path), then removes temp object, then inserts into `gallery_images` with `owner_id`, `album_id`, `path` (the `toPath`). Returns `{ ok: true, finalPath, imageId }`.
5. **DB writes:** Album creation: single insert into `gallery_albums`. Image creation: only via promote — insert into `gallery_images`. Upload-url does **not** write to DB; it only issues a signed URL and checks quota via RPC.

**Path inconsistency (as implemented):** Direct upload with `albumId` uses path `ownerId/albums/albumId/...`. Promote copies to `ownerId/albumId/...` (no `albums`). So temp→album promoted files live under `ownerId/{albumId}/`, while direct-to-album uploads would live under `ownerId/albums/{albumId}/`. `gallery_images.path` stores whatever path promote uses (`ownerId/albumId/filename`).

---

## 7. Storage & quotas

- **Bucket:** Name is `gallery` (hard-coded). Paths: `{ownerId}/temp/...` (temporary), `{ownerId}/albums/{albumId}/...` (direct album upload), `{ownerId}/{albumId}/...` (after promote).
- **RLS policies:** Not defined in this repo. All server access uses the Service Role client, which bypasses Supabase RLS. Bucket RLS (if any) is in Supabase project only.
- **Quota enforcement:** Implemented in upload-url route via Supabase RPC `can_user_upload(p_owner_id, p_new_file_size)`. If RPC errors → 500. If result !== true → 403 with `error: "quota_exceeded"`. Quota logic (limits, current usage) is **not** in this repo — it lives in the Supabase project.
- **When quota exceeded:** Upload-url returns 403 JSON `{ error: "quota_exceeded" }`. No other handling (e.g. user-facing message text) is defined in this app beyond that response.

---

## 8. Security model

- **RLS:** This app does not define or enforce RLS. It uses a **Service Role** client for all Supabase access (`lib/supabase/admin.ts`, and upload-url creates its own client with service role). So database and storage access are enforced in application code, not by Supabase RLS in this codebase.
- **Server-side enforcement:** Session is enforced where `getGallerySession()` is used: albums list, album detail, album create, promote. Upload-url does **not** call `getGallerySession()`; it trusts the request body field `ownerId`. So any caller that can reach `POST /api/gallery/upload-url` can request a signed URL for an arbitrary `ownerId` (subject only to `can_user_upload` and storage path rules). Ownership of uploaded files is enforced later when/if promote is called (promote requires session and validates temp path prefix).
- **Admin / service role:** Service role is used for all server-side Supabase operations (albums CRUD, promote copy/remove/insert, upload-url signed URL + RPC). No separate “admin” role or endpoint in this app; “admin” here means the server acting with service role on behalf of the logged-in user (identity from cookie).

---

## 9. Known limitations (intentional or current)

- **Upload-URL not session-protected:** `/api/gallery/upload-url` does not verify `gallery_session`. It accepts `ownerId` in body. Quota is checked for that `ownerId`; anyone who can call the API can request upload URLs for any `ownerId`.
- **Upload-test page auth mismatch:** `app/upload-test/page.tsx` uses Supabase Auth (`supabase.auth.getUser()`) to decide if the user is “logged in” and sends that user id as `ownerId`/`owner_id`. The rest of the app uses `gallery_session` (Vizi user_id). So upload-test is only valid if Supabase Auth user id and Vizi user id are the same, or for ad-hoc testing with a chosen owner; it is a test/dev page, not the main product flow.
- **Album detail images:** Album detail page (`/albums/[id]`) shows placeholder text “Ovdje će uskoro biti slike.” No listing or display of `gallery_images` is implemented.
- **No middleware:** No Next.js middleware; protection is per-route (server components and API handlers call `getGallerySession()` and redirect or return 401).
- **Env vars:** Upload-url uses `NEXT_PUBLIC_SUPABASE_URL`; admin client uses `SUPABASE_URL`. `.env.example` only lists `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VIZI_BASE_URL`. Upload-test expects `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not in .env.example).
- **Promote destination path:** Promote writes to `ownerId/albumId/filename`; upload-url with albumId uses `ownerId/albums/albumId/...`. Two different storage path shapes for “album” files.
- **Hard-coded:** Bucket name `gallery`; cookie name `gallery_session`; max-age 7 days; Vizi default base URL in config; upload-test uses a constant `TEST_ALBUM_ID`.
- **No SQL in repo:** Table schemas, RLS, and `can_user_upload` are NOT IMPLEMENTED in this repository; they are assumed to exist in the Supabase (Vizi) project.

---

## 10. Entry points & routes

| Route | Protection | Purpose |
|-------|------------|--------|
| `GET /` | None (redirect only) | Redirect: if session → `/albums`, else → `{VIZI_BASE_URL}/app` |
| `GET /sso` | None | SSO callback page; shows form to POST token to `/api/session` |
| `GET /albums` | Session (redirect to Vizi if missing) | List user’s albums, form to create album |
| `GET /albums/[id]` | Session + owner check (else redirect `/albums`) | Album detail; placeholder for images |
| `GET /upload-test` | None | Dev/test upload UI (uses Supabase Auth for “logged in”) |
| `POST /api/session` | None | Verify token with Vizi, set `gallery_session` cookie, redirect to `/albums` or error |
| `POST /api/albums` | Session (redirect to Vizi if missing) | Create album (form: name, description), redirect to `/albums` or error |
| `POST /api/gallery/upload-url` | **None** (accepts `ownerId` in body) | Return signed upload URL after quota check |
| `POST /api/gallery/promote` | Session (401 if missing) | Move temp file to album path, delete temp, insert `gallery_images` row |

**Public (no auth):** `/`, `/sso`, `/upload-test`, `POST /api/session`, `POST /api/gallery/upload-url`.  
**Protected (session required):** `/albums`, `/albums/[id]`, `POST /api/albums`, `POST /api/gallery/promote`.

---

*End of report. All statements reflect the codebase as of the analysis date.*
