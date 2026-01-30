# FAZA 24 — Product Readiness & Monetization Direction

---

## 1. FAZA 24 — Cilj

- **Definirati MVP kriterije za "Ready for Launch"** — jasna checklista funkcionalnosti koje moraju biti stabilne prije javnog lansiranja
- **Usmjeriti monetizaciju** — definirati tri pricing plana (Free, Pro, Business) s jasnim feature setovima i limitima, bez implementacije
- **Postaviti paywall pravila** — što ostaje besplatno zauvijek, a što zahtijeva subscription (označeno za buduće featuree)

---

## 2. Definicija "Ready for Launch" (MVP)

### a) Auth & Onboarding

- [x] Korisnik se može registrirati (signup)
- [x] Korisnik se može prijaviti (login)
- [x] OAuth callback flow radi stabilno
- [x] Onboarding flow za postavljanje usernamea funkcionira
- [x] Middleware zaštita za zaštićene rute
- [ ] Email verification (opcionalno za MVP, ali preporučeno)

### b) Profile creation & editing

- [x] Korisnik može kreirati profil (full_name, headline, location, website, avatar_url)
- [x] Korisnik može editirati svoj profil
- [x] Username validacija i normalizacija
- [x] Social links (LinkedIn, Instagram, WhatsApp, Facebook, YouTube, TikTok)
- [x] Avatar upload/URL podrška
- [ ] Image upload storage (trenutno samo URL, storage je future)

### c) Public profile view

- [x] Public profile dostupan na `/@username` ruti
- [x] Profil se učitava preko API endpointa
- [x] 404 handling za nepostojeće profile
- [x] Responsive design (mobile-friendly)
- [x] Dark theme UI konzistentan
- [x] Social links se prikazuju s ikonama
- [x] Website link normalizacija i prikaz

### d) Share (link/QR) UX

- [x] Copy link funkcionalnost s clipboard API
- [x] Fallback za starije browsere (execCommand)
- [x] "Copied" state feedback (ikona + tekst promjena)
- [x] QR code generacija i prikaz
- [x] Cleanup timeouta (memory leak prevention)
- [x] Produkcijski testiran i verificiran

### e) Reliability & errors (API/DB)

- [x] API endpointi za public profile read
- [x] Error handling u API rutama (404, 500)
- [x] Database migracije strukturirane
- [x] Supabase connection pooling konfiguriran
- [ ] Error logging/monitoring (future — nije u scopeu za MVP)
- [ ] Rate limiting (future — nije u scopeu za MVP)

### f) Security (RLS) basics

- [x] Row Level Security (RLS) omogućen na profiles tablici
- [x] SELECT policy: korisnik vidi samo svoj profil
- [x] INSERT policy: korisnik može kreirati samo svoj profil
- [x] UPDATE policy: korisnik može updateati samo svoj profil
- [x] Public read policy za public profile endpoint
- [x] DELETE policy eksplicitno onemogućen
- [ ] CSRF protection (Next.js default, ali treba verificirati)

### g) Basic analytics

- [ ] **Nije u scopeu za FAZU 24** — analytics nije implementiran i nije dio MVP kriterija

### h) Support/contact flow

- [ ] **Nije u scopeu za FAZU 24** — support flow nije implementiran; može biti future feature ili se može riješiti preko emaila za sada

---

## 3. Monetizacija — Prijedlog planova (bez implementacije)

### Plan 1: Free

**Target user:** Individualni korisnici, studenti, hobisti, early adopters

**Included features:**
- 1 profil po korisniku
- Osnovni profil (full_name, headline, location, website, avatar)
- Do 6 social links (LinkedIn, Instagram, WhatsApp, Facebook, YouTube, TikTok)
- Public profile view na `vizi.hr/@username`
- Share link + QR code generacija
- Dark theme UI

**Limits:**
- 1 profil po accountu
- Standardni subdomain (`vizi.hr/@username`)
- Custom domain: **future**
- Analytics: **future**
- Custom branding: **future**

**Suggested monthly price:** €0 (placeholder)

---

### Plan 2: Pro

**Target user:** Profesionalci, freelanceri, mali biznisi, content creatori

**Included features:**
- Sve iz Free plana
- Do 3 profila po accountu
- Custom domain (future)
- Basic analytics (future — page views, link clicks)
- Custom color scheme (future)
- Priority support (future)

**Limits:**
- 3 profila po accountu
- Custom domain: 1 domena po accountu (future)
- Analytics retention: 90 dana (future)
- API access: **future**

**Suggested monthly price:** €9 (placeholder)

---

### Plan 3: Business

**Target user:** Agencije, timovi, organizacije, enterprise klijenti

**Included features:**
- Sve iz Pro plana
- Neograničen broj profila
- Neograničen broj custom domena (future)
- Advanced analytics (future — detailed metrics, export)
- White-label branding (future)
- Team management (future — multiple users per account)
- API access s rate limits (future)
- Priority support + SLA (future)

**Limits:**
- Neograničen broj profila
- Custom domain: neograničeno (future)
- Analytics retention: neograničeno (future)
- API rate limit: TBD (future)

**Suggested monthly price:** €29 (placeholder)

---

## 4. Paywall pravila (što je zaključano u Free)

### Besplatno zauvijek (Free plan):

- 1 profil po korisniku
- Osnovni profil fields (full_name, headline, location, website, avatar)
- Do 6 social links
- Public profile view na standardnom subdomainu (`vizi.hr/@username`)
- Share link + QR code generacija
- Dark theme UI (default)

### Zahtijeva subscription (Pro/Business):

- **Više profila** — Pro (3), Business (neograničeno)
- **Custom domain** — Pro i Business (future)
- **Analytics** — Pro (basic), Business (advanced) (future)
- **Custom branding** — Pro (color scheme), Business (white-label) (future)
- **Team management** — Business only (future)
- **API access** — Business only (future)
- **Priority support** — Pro i Business (future)

---

## 5. "No scope creep" ograda

**Eksplicitno OUT of scope za FAZU 24:**

- ❌ CMS (content management system)
- ❌ Plugin marketplace ili ekstenzije
- ❌ Complex page builders (drag & drop)
- ❌ Multi-language support (i18n)
- ❌ Advanced SEO tools
- ❌ Email marketing integracije
- ❌ Payment processing implementacija (samo planiranje)
- ❌ Subscription management UI (samo planiranje)
- ❌ Analytics implementacija
- ❌ Custom domain DNS management (samo planiranje)
- ❌ Team collaboration features
- ❌ API dokumentacija i developer portal

**FAZA 24 je isključivo dokumentacija i strategija — NIJE implementacija novih featurea.**

---

## 6. Sljedeći korak (FAZA 24.1)

👉 **Implementacija subscription management osnove** — dodati `subscription_tier` kolonu u `profiles` tablicu (enum: 'free', 'pro', 'business') s default vrijednošću 'free', plus RLS policy koja dozvoljava update samo vlastitog tier-a (za buduću integraciju payment providera).

**Akcija:** Kreirati Supabase migraciju koja dodaje `subscription_tier` kolonu i osnovnu RLS logiku, bez payment provider integracije.

---
