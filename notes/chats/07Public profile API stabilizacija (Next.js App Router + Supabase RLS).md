## STRUCTURED SUMMARY / HANDOFF

### 1. Chat broj

**Chat #7**

### 2. Naslov chata

**Vizi.hr — Public profile API stabilizacija (Next.js App Router + Supabase RLS)**

### 3. Faza projekta

**FAZA 3 — Public profile & username resolution**

### 4. Što smo konkretno napravili / zaključili

* Ispravljen **Next.js App Router GET handler signature** (NextRequest + `params: Promise<{ username }>`).
* Riješeni **TypeScript build errori** na Vercelu (RouteHandlerConfig).
* Uklonjen nepostojeći stupac `full_name` iz Supabase selecta.
* Potvrđene i aktivirane **Supabase env varijable** za Production i Preview.
* Dodan **RLS policy** za public read nad tablicom `profiles`.
* Razjašnjena i ispoštovana **FK veza** `profiles.id → auth.users.id`.
* Kreiran ispravan `profiles` zapis vezan uz postojeći auth user (`dplasc`).
* Verificiran **public API endpoint** `/api/public/profiles/by-username/[username]`:

  * 200 za postojeći profil
  * 404 za nepostojeći
* Uklonjen sav privremeni **debug output** (production cleanup).
* Commit i push na `origin/main`; deploy **Ready**.
* Potvrđena funkcionalnost na **production domeni (`vizi.hr`)**.

### 5. Što je IZRIČITO odlučeno (zaključano)

* `profiles` je jedina tablica za public profile.
* Public read ide preko **anon key + RLS policy**.
* `profiles.id` je FK na `auth.users.id` (nema random UUID-a).
* API responsei su **minimalni** (bez debug podataka).
* Endpoint ponašanje: 200 / 404 / 400 / 500, bez dodatnih polja.

### 6. Otvorene stavke

* **Nema otvorenih stavki** u FAZI 3.

### 7. Sljedeći dogovoreni korak (jedan)

* **FAZA 4 — Onboarding flow (save username za prijavljenog usera).**

### 8. Napomena za nastavak u novom chatu

* Novi chat započeti s oznakom **FAZA 4**.
* Fokus: nakon signup/login provjeriti postoji li `profiles` zapis, kreirati ako ne postoji i napraviti redirect na `/${username}`.
