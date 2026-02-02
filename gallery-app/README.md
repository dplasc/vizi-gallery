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
