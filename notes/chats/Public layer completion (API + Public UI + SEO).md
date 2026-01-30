Chat #7

2. Naslov chata

Vizi.hr — Public layer completion (API + Public UI + SEO)

3. Faza projekta

FAZA 6 — Public profile API (by id) ✔️

FAZA 6.5 — Username schema & public view update ✔️

FAZA 7 — Public profile API (by username) ✔️

FAZA 8 — Public profile page (read-only UI) ✔️

FAZA 9 — SEO & metadata (public profile) ✔️

FAZA 10 — Loading & error states (public page) ✔️

FAZA 11 — Not-found page for /[username] ✔️

4. Što smo konkretno napravili / zaključili

Implementiran public read API:

GET /api/public/profiles/[id]

GET /api/public/profiles/by-username/[username]

oba čitaju isključivo iz viewa public.public_profiles

bez autha, bez cookies, bez UI-a

U bazi:

dodan stupac profiles.username (text, NOT NULL, unique, case-insensitive)

ažuriran view public.public_profiles → id, username, full_name

Riješen Supabase permission model:

API koristi service role server-side

anon nikad ne čita direktno public.profiles

Implementirana public profile stranica:

ruta app/[username]/page.tsx

server component

fetch preko internog API-ja

shadcn-only UI (Card)

Dodan SEO sloj:

generateMetadata

title, description, OpenGraph, Twitter

robots noindex za 404

Dodani UX stateovi:

loading.tsx (skeleton)

error.tsx (reset button)

not-found.tsx (premium not-found UI)

Uveden minimalni shadcn setup:

components/ui/card.tsx

components/ui/button.tsx

lib/utils.ts

bez lomljenja Tailwinda

5. Što je IZRIČITO odlučeno (zaključano)

Public layer:

nikad ne čita public.profiles direktno

ide isključivo preko public.public_profiles viewa

username je:

jedini javni identifikator u URL-u

unique i case-insensitive

Public UI:

read-only

bez autha

bez editiranja

UI stack:

shadcn-only

dark theme

minimalan, bez page buildera

FAZE 6 → 11 su zauvijek zaključane

6. Otvorene stavke

Nema otvorenih stavki iz FAZA 6–11

7. Sljedeći dogovoreni korak (jedan)

FAZA 12 — Root landing page (/)

minimalni landing s inputom za username

redirect na /${username}

bez autha, bez baze
8. Napomena za nastavak u novom chatu

Novi chat treba započeti s ovim handoffom.
Nastavljamo FAZU 12, isključivo na public navigaciji (root landing), bez diranja postojećeg public layera.