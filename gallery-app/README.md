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

## Routes

- `/` — Redirects to /albums if logged in, else to Vizi app
- `/sso?token=...` — SSO callback from Vizi (verify token, set cookie, redirect to /albums)
- `/albums` — Protected; shows "Moji albumi" empty state

## Config

Copy `.env.example` to `.env.local` and set `VIZI_BASE_URL` if needed (default: https://www.vizi.hr).
