# TLH Sports Fest 3.0 — Registration system

A complete registration system for TLH Sports Fest 3.0, III Edition. It is a
plain static website, a Google Apps Script backend and a Google Sheet.

## What is here

- **Frontend** in `index.html`, `assets/css/` and `assets/js/`: a mobile-first
  four-step wizard, live age and fee checks, draft saving, bank-detail copy,
  upload retries and a Print summary. No framework and no build step.
- **Backend** in `backend/`: one Apps Script project connected to the Sheet.
  It is deployed as a web app with a stable `/exec` URL.
- **Shared rules** in `shared/rules.js`, the single source of truth for prices,
  age eligibility, division rules, contact validation and formula sanitising.
  `scripts/sync-rules.js` copies it to `backend/Rules.gs` and
  `assets/js/rules.js`; tests fail if the copies differ.
- **Seed** data in `data/games.seed.csv` and generated Apps Script copies in
  `backend/SeedGames.gs` and `assets/js/mock-games.js`.
- **Tests** in `tests/` using Node's built-in test runner.

## Project status

- Run `npm test` to run the rule, seed, sync and frontend checks.
- `npm run sync:check` verifies the two generated copies of `shared/rules.js`
  are still current.
- `npm run seed` regenerates the seed, `SeedGames.gs` and the mock game list.
- `npm run serve` starts a local preview at `http://localhost:8080/`.

## Current deployment

- Frontend: `https://chhaiderumerfarooq.github.io/tlhsportsfest2027/`
- Backend: `https://script.google.com/macros/s/AKfycbysy7oeXh4ruNr8xNIm4oIqO5zGEsFTMBit1zAwPDGd2x76dx2M4Mj-brjjNoxsDy6XLg/exec`
- Sheet: **TLH Sports Fest 3.0** in the owner's Google Drive. It is created
  automatically the first time the deployed web app receives a request.

`setupWorkbook()` is still the safe repair command. Running it again never
deletes data.

## Owners and sources

Read the full spec first: `PROMPT.md`. Then read `shared/rules.js` for the
business rules, `backend/Workbook.gs` for the Sheet setup/menu/triggers, and
`backend/Main.gs` for the API. Do not redefine shared helpers in other files:
`cleanText_`, `parseBool_`, `pad2_`, `formatNumber`, `formatPKR`, `normalizeWhatsapp`,
`isValidIdNumber`, `sanitizeCell`, `groupIban`, `buildRoster` and friends already
exist in `Rules.gs`/`rules.js`.

## Out of scope by design

There is intentionally no online payment gateway, ticket sales, fixtures and
scoring, user accounts or Cloud infrastructure. Payments are verified by hand in
the Sheet and on the registration team's Drive folders.

---

## Manual steps when you are done building

### 1. Build the site locally (optional, for testing)

```sh
npm install
npm run seed            # regenerate seed/mock data if you change PROMPT facts
npm test
npm run serve
```

Visit `http://localhost:8080/`. The committed `assets/js/config.js` points at
the deployed backend (`USE_MOCK = false`). Add `?mock=1` to any URL to force the
offline mock, or set `USE_MOCK = true` while working without a backend.

### 2. Set up the Google Sheet

1. You do **not** have to create the Sheet by hand. The backend creates
   **TLH Sports Fest 3.0** on its first request and remembers the ID in Script
   Properties. If you prefer to create it first, any blank Sheet works.
2. Open **Extensions > Apps Script**.
3. In the script editor, create or open the TLH Sports Fest 3.0 project.
4. Paste these files into the editor:
   - `backend/appsscript.json`
   - `backend/Utils.gs`
   - `backend/Rules.gs`
   - `backend/SeedGames.gs`
   - `backend/Workbook.gs`
   - `backend/Main.gs`
   - `backend/Emails.gs`
5. Click **Save**, then run `setupWorkbook()` once from the Apps Script menu.
   Authorise the requested permissions. The list of permissions is in `SETUP.md`;
   you will not be asked for passwords or access tokens anywhere in this repo.
   The first request to the deployed web app also runs the setup automatically.

### 3. Deploy the web app

With the script open:

1. Click **Deploy > Create a new deployment** (or **Get started > Web app**).
2. Set **Execute as** to **Me (your name)** or **executeAs: USER_DEPLOYING**.
   The script uses `USER_DEPLOYING`; keep that.
3. Set **Who has access** to **Anyone, including anonymous**.
4. Click **Deploy**.
5. When prompted to authorise, approve the Google permissions.
6. Copy the **web app URL**, something like `https://script.google.com/d/.../exec`.
   It must stay stable: do not delete old deployments if you need the old URL.

To republish a new version later: **Deploy > Manage deployments**, find the TLH
Sports Fest web app, click **Edit**, then **New version**, then **Deploy**.

### 4. Wire the site to the backend

1. Edit `assets/js/config.js` and set:

   ```js
   export const API_URL = 'https://script.google.com/d/<your-deployment-id>/exec';
   export const USE_MOCK = false;
   ```

2. Commit this change and push it to the GitHub Pages repository.
3. **Settings > Pages**, then make sure **Pages** is enabled for `main` or
   `gh-pages` and the site is at the repository root.

### 5. Smoke test for real

1. Open the live site on your phone: `https://<your-username>.github.io/<repo-name>/`.
2. Register one test team for a fast game such as **Feel the Beat**, then delete
   it later.
3. Confirm the confirmation email arrives to the test address.
4. In the Sheet, change `PaymentStatus` to `Verified` to test the email/status path.
5. If you want to edit later: run **TLH Sports Fest > Refresh website data**
   to clear the 60-second cache.

### 6. Push on release day

1. Close the form: set `RegistrationOpen = FALSE`, or set
   `RegistrationCloseDate` to a date after the event so registrations stop.
2. Watch registrations on the Sheet and Drive folders.
3. At the event, show a note if the fee in the Sheet differs from what the site
   said during the form.

### 7. When something breaks

Read `TROUBLESHOOTING.md`. Before contacting support, check:

- Redeploy a **new version** of the web app; the old `/exec` URL does not pick
  up code changes in every tool state.
- Confirm you pasted the right files in the right order and saved.
- Confirm the site uses the new API URL; a cache may show an old site.
- `TROUBLESHOOTING.md` also covers CORS, authorization and email quota errors.

---

## If you are using Clasp

If you already have Clasp installed:

```sh
clasp login
clasp clone https://script.google.com/d/<your-deployment-id>/edit  # or create new
clasp push
```

Make sure your local `clasp` project contains the same files as this repo:

```sh
.
├── appsscript.json
├── Utils.gs
├── Rules.gs
├── SeedGames.gs
├── Workbook.gs
├── Main.gs
├── Emails.gs
```

`appsscript.json` keeps `executeAs`, `access` and the required OAuth scopes, so
you can review them before authorisation.

## Brand images

`assets/img/logo-640.png` and `logo-640.webp` are the site logo. If you change
the logo, run:

```sh
python3 scripts/build-images.py
```

This regenerates favicons and the 1200×630 Open Graph image. It is optional for
the first upload because the files are already committed.
