# FAZA 24.1 — Launch Gate Checklist

---

## 1. Launch Gate — Što znači "smijemo u launch"

**Launch Gate** je finalna produkcijska verifikacija prije javnog lansiranja. Ako sve stavke u checklisti prolaze, aplikacija je spremna za realne korisnike. Ako bilo koja stop condition aktivira, launch se blokira dok se problem ne riješi.

---

## 2. Checklist (Production)

### Auth & Session

- [ ] **Registracija radi** — Kako testiram: Otvorim `/signup`, unesem email i password, kliknem "Sign up". Očekujem: redirect na onboarding ili dashboard bez errora.
- [ ] **Login radi** — Kako testiram: Otvorim `/login`, unesem validne credentials, kliknem "Sign in". Očekujem: uspješan login i redirect na profil.
- [ ] **Zaštićene rute blokiraju neautenticirane** — Kako testiram: Odlogiram se, pokušam otvoriti `/app/profile` direktno. Očekujem: redirect na `/login`.
- [ ] **Onboarding flow radi** — Kako testiram: Nakon registracije, unesem username u onboarding formu. Očekujem: username se spremi i redirect na profil.

### Create/Edit Profile

- [ ] **Kreiranje profila radi** — Kako testiram: U `/app/profile` unesem full_name, headline, location, website, kliknem "Save". Očekujem: podaci se spreme i prikažu na stranici.
- [ ] **Edit profila radi** — Kako testiram: Promijenim bilo koji field u `/app/profile/edit`, kliknem "Save". Očekujem: promjene se spreme i vidim ih na profilu.
- [ ] **Social links se spremaju** — Kako testiram: Dodam LinkedIn i Instagram linkove u edit formi, kliknem "Save". Očekujem: linkovi se prikažu na public profilu.
- [ ] **Avatar URL se prikazuje** — Kako testiram: Unesem validan image URL u avatar field, kliknem "Save". Očekujem: avatar se prikaže na public profilu.

### Public Profile

- [ ] **Public profil se učitava** — Kako testiram: Otvorim `https://www.vizi.hr/@mojusername` u incognito prozoru. Očekujem: profil se učitava bez errora, prikazuju se svi podaci.
- [ ] **404 za nepostojeći profil** — Kako testiram: Otvorim `https://www.vizi.hr/@nepostojeci123456`. Očekujem: 404 Not Found stranica.
- [ ] **Social links su klikabilni** — Kako testiram: Na public profilu kliknem na LinkedIn ili Instagram link. Očekujem: otvara se external link u novom tabu.
- [ ] **Website link radi** — Kako testiram: Kliknem na website link na public profilu. Očekujem: otvara se external website u novom tabu.
- [ ] **Responsive design radi** — Kako testiram: Otvorim public profil na mobilnom browseru (ili DevTools mobile view). Očekujem: layout je čitljiv, nema horizontalnog scrolla.

### Share UX (link + QR)

- [ ] **Copy link radi** — Kako testiram: Na public profilu kliknem "Copy link", zatim lijepim u notepad. Očekujem: URL se lijepi u formatu `https://www.vizi.hr/@username`.
- [ ] **"Copied" state se prikazuje** — Kako testiram: Kliknem "Copy link". Očekujem: gumb mijenja tekst u "Copied" i ikonu u checkmark na ~2 sekunde.
- [ ] **QR code se generira** — Kako testiram: Na public profilu vidim QR code ispod "Copy link" gumba. Očekujem: QR code je vidljiv i skenira se u validan URL.
- [ ] **QR code skeniranje radi** — Kako testiram: Skeniram QR code s mobilnim telefonom. Očekujem: otvara se public profil u browseru.

### Security (RLS sanity)

- [ ] **Ne mogu vidjeti tuđi profil preko APIja** — Kako testiram: U browser console na `/app/profile` pokušam fetchati API endpoint s tuđim user ID-om. Očekujem: 403 ili 404 error (ne mogu pristupiti tuđim podacima).
- [ ] **Ne mogu editirati tuđi profil** — Kako testiram: Pokušam direktno editirati tuđi profil preko API poziva. Očekujem: 403 Forbidden error.
- [ ] **Public read radi bez auth** — Kako testiram: U incognito prozoru otvorim public profil API endpoint direktno. Očekujem: 200 OK s profile podacima (samo public fields).

### Error handling

- [ ] **API error se prikazuje korisniku** — Kako testiram: Simuliram network error (npr. offline mode), pokušam spremiti profil. Očekujem: error message se prikaže korisniku (ne samo u console).
- [ ] **404 stranica postoji** — Kako testiram: Otvorim nepostojeći profil. Očekujem: prikazuje se 404 Not Found stranica (ne blank page ili error).
- [ ] **Network timeout se handla** — Kako testiram: U DevTools postavim "Slow 3G", pokušam učitati profil. Očekujem: stranica se eventualno učita ili prikaže timeout message (ne infinite loading).

### Contact/Support

- [ ] **Nema broken links** — Kako testiram: Prođem kroz sve stranice, kliknem sve linkove. Očekujem: nema 404 ili broken linkova unutar aplikacije.

---

## 3. Stop conditions

- ❌ **Bilo koji auth flow ne radi** — login, signup ili session management ne funkcioniraju → launch blokiran
- ❌ **Korisnik ne može kreirati ili editirati profil** — core funkcionalnost ne radi → launch blokiran
- ❌ **Public profil se ne učitava ili prikazuje greške** — javni dio aplikacije ne radi → launch blokiran
- ❌ **RLS security propušta podatke** — korisnik može pristupiti tuđim podacima → launch blokiran
- ❌ **Share/QR funkcionalnost ne radi** — core sharing feature ne funkcionira → launch blokiran

---

## 4. Evidence to collect

- 📸 **Screenshot: Uspješan login flow** — capture `/login` stranice i redirect nakon login-a
- 📸 **Screenshot: Kompletan public profil** — capture `https://www.vizi.hr/@testusername` s svim podacima i social links
- 📸 **Screenshot: Share section s QR codeom** — capture ShareSection komponentu s "Copied" state-om
- 📸 **Screenshot: 404 stranica** — capture Not Found stranicu za nepostojeći profil
- 🔗 **URL lista: 3 test profila** — spremi 3 različita public profile URL-a za regression testing

---
