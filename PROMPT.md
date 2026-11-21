# TLH Sports Fest 3.0 Registration System: Build Prompt

You are a senior full stack developer. Build the complete registration system for TLH Sports Fest 3.0, a school sports festival in Pakistan. Deliver working code, a setup guide for a non-developer, and tests. Follow this spec closely. Where it says nothing, choose the simplest option and record the choice in DECISIONS.md. Ask me a question only if you are blocked. Never ask me for passwords or tokens in chat. Tell me which commands to run instead.

Files in this project folder:

- `data/Games_details_xlsx_-_Games.csv` (the games list)
- `reference/TLH_SportsFest_3_0_-_logo__white_.png` (white logo, transparent background, 3847 x 3555 px)
- `reference/TLH_SportsFest_poster.jpeg` (the event poster, for brand colors only)

## 1. Event facts

- Name: TLH Sports Fest 3.0 (III Edition, established 2024). Always write it that way.
- Dates: Saturday 30 and Sunday 31 January 2027. Venue: TLH Canal Campus.
- Early bird ends at the end of 10 December 2026. Registration closes at the end of 20 December 2026. Both must be editable from the Google Sheet with no code change.
- Timezone Asia/Karachi (UTC+5, no daylight saving). Currency PKR, shown as Rs 6,000.
- Visitors are students, parents and teachers. Most will use a phone and open the link from WhatsApp. Many connections are slow. Design mobile first.
- Socials tickets are sold separately and are not included in the registration fee. The site must say so (see section 6).
- Out of scope: online payment gateway, fixtures and scoring, ticket sales, user accounts.

## 2. Architecture (fixed, do not change)

- **Frontend:** static site in plain HTML, CSS and JavaScript (ES modules). No framework and no build step, so a non-developer can edit it. Hosted on GitHub Pages from the repo root. No secrets in the repo. Use relative paths everywhere so the site works at `username.github.io/repository-name/`, and add an empty `.nojekyll` file.
- **Backend:** one Google Apps Script project bound to the Google Sheet, deployed as a web app. Set `"webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"}` in `appsscript.json`. Also set `"timeZone": "Asia/Karachi"` and `"runtimeVersion": "V8"`, and declare only the OAuth scopes you need (Sheets, Drive, sending mail, triggers). List them in `SETUP.md` so I know what the permission screen will ask for. Use `SpreadsheetApp.getActiveSpreadsheet()`. If that fails inside the web app context, store the Sheet ID in Script Properties during setup and use it from there.
- **Data:** Google Sheet. **Files:** Google Drive. No Cloud Console, API keys or service accounts.
- **Transport:** the browser calls the web app with `fetch`. POST requests send a JSON string with `Content-Type: text/plain;charset=utf-8`, so the browser sends no CORS preflight (Apps Script cannot answer one). Responses are JSON from `ContentService`. Test from both a `github.io` origin and `localhost`.
- **Stable URL:** the `/exec` URL must never change. Document how to publish a new version of the existing deployment (Deploy, Manage deployments, Edit, New version). With clasp, use `clasp deploy --deploymentId <id>`.
- The web app URL lives in one place: `assets/js/config.js` as `API_URL`.
- Backend source lives in `/backend` and must work both with clasp and by pasting into the editor. Document both.

Repo layout:

- `index.html`, `assets/css/`, `assets/js/`, `assets/img/` (optimized logo and images used by the site)
- `backend/` (Apps Script files and `appsscript.json`)
- `shared/rules.js` (pricing and eligibility rules, see section 11), `scripts/`, `tests/`
- `data/` (the CSV) and `reference/` (the original logo and poster, kept as source only)
- `README.md`, `SETUP.md`, `ADMIN_GUIDE.md`, `TESTING.md`, `TROUBLESHOOTING.md`, `DECISIONS.md`, `IMPORT_NOTES.md`

## 3. Google Sheet design

Write `setupWorkbook()` in Apps Script. It must be safe to run many times: it creates or repairs tabs and never deletes data. It sets headers, a frozen header row, column widths, dropdowns, conditional formatting, plain text format for phone and ID columns, warning-only protection on columns the script writes, and brand colors on header rows. Add a custom menu called TLH Sports Fest with Set up or repair workbook as the first item.

**Config tab** (columns Key, Value, Notes). Seed these keys:

- `EventName`: TLH Sports Fest 3.0
- `EventDates`: Sat 30 and Sun 31 January 2027
- `Venue`: TLH Canal Campus
- `Timezone`: Asia/Karachi
- `RegistrationOpen`: TRUE (master switch, FALSE closes the form immediately)
- `EarlyBirdEndDate`: 2026-12-10 (inclusive, valid through 23:59:59)
- `RegistrationCloseDate`: 2026-12-20 (inclusive, valid through 23:59:59)
- `AgeCutoffDate`: 2027-01-30
- `BankName`: Bank Alfalah
- `AccountTitle`: Genesis Educational Service Pvt Ltd.
- `IBAN`: PK08ALFH0053001010451307
- `Contact1Name`: Javed Iqbal. `Contact1Role`: Event Head. `Contact1Phone`: +92 301 6884762. `Contact2Name`: Hadiqa Mazhar. `Contact2Role`: Event Head. `Contact2Phone`: +92 324 8686769. Show these as call and WhatsApp contacts on the site and in the emails. Build the wa.me links from the phone number in international format with no plus sign or spaces (923016884762 and 923248686769). `SupportEmail`: blank and optional, used as the reply-to address on emails.
- `SocialsNotice`: Socials tickets are sold separately. They are not included in your registration fee.
- `ConsentText`: I confirm that the details are correct, every player meets the age rule for the group entered, and I have a parent or guardian's permission for any player under 18.
- `AnnouncementBanner`: blank (shows a banner at the top of the site when filled)
- `ReferencePrefix`: TSF3
- `MaxFileMB`: 5
- `SendConfirmationEmails` and `SendStatusEmails`: TRUE
- `TestNowOverride`: blank. When filled with a date and time, the server uses it instead of the real time, so I can test the early bird cut-off and the closing date. The Dashboard shows a red warning while it is set.

Accept date cells as real dates or as yyyy-mm-dd text. Changes to Config and Games must reach the website within about a minute.

**Games tab.** Columns: GameID, Active, SortOrder, Name, Category, Format (Team, Single, Double or Individual), Divisions (Boys, Girls, Boys,Girls or Open), AgeGroups (comma list of U19, U17, U15, or Open), EarlyFee, RegularFee, MinPlayers, MaxPlayers, MaxEntries (blank means no limit), Details, Prizes. Also keep the internal columns Coach, Head, CoHead1 and CoHead2. The API never returns the internal columns.

**Submissions tab** (one row per form submission). SubmissionID, Timestamp (PKT), ContactName, ContactRole, WhatsApp, Email, Institution, EntryCount, FeeType (Early Bird or Regular), RegularTotal, NetTotal, PaymentProof (HYPERLINK), TransactionID, PaymentStatus (dropdown: Pending, Verified, Rejected), VerifiedAt, NoteToRegistrant, InternalNotes, DriveFolder (link), EmailStatus, Token (hidden column).

**Entries tab** (one row per game entered). EntryID, SubmissionID, Timestamp, GameID, Game, Category, Format, AgeGroup, Division, TeamName, Institution, PlayerCount, FeeCharged, FeeType, Roster (text such as 1. Name (DOB)), PaymentStatus (kept in sync from Submissions), Flags, Notes.

**Players tab** (one row per player per entry). PlayerRowID, EntryID, SubmissionID, Game, AgeGroup, Division, No, Role (Captain, Player or Extra), FullName, DOB, AgeOnCutoff, IDNumber, IDFile (HYPERLINK).

**Dashboard tab.** Formulas only. Entries per game and age group, payments by status, expected and verified revenue, early bird versus regular count, total players.

**Logs tab.** Time, Level, Action, Message, Details.

A student who enters three games creates three Entries rows and three sets of Players rows, all under one Submission. Entries are always separate per game.

## 4. Importing the games list

Write `backend/SeedGames.gs`, and also output `data/games.seed.csv` so I can review the result. Rules:

- GameID: G01 to G35, from Sr #.
- Fees: remove commas and store numbers.
- Name: remove the markers `( boys girls)` and `( Boys)` and tidy the spacing. Keep platform tags such as (PS), (PC) and (Mobile). For Single and Double formats append the format, for example Badminton (Singles) and Badminton (Doubles), so every name is unique.
- Divisions: `( boys girls)` in the original name becomes Boys,Girls. `( Boys)` becomes Boys. No marker becomes Open.
- Format: Team Game becomes Team, Single stays Single, Double stays Double, Individuals becomes Individual. Blank becomes Individual. The row with Sr # 19 (PUBG Mobile) has `( boys girls)` typed into the Format cell by mistake. Treat its Format as blank.
- Category: Ground Game becomes Ground Games, Indoor Games stays, E games becomes E-Games, Workshop becomes Workshops. Blank becomes Other.
- Players: `7 players + 2 extra` becomes MinPlayers 7 and MaxPlayers 9. `5 players + 2 extra` becomes 5 and 7. Single and Individual are 1 and 1. Double is 2 and 2.
- AgeGroups: copy the list. Blank becomes Open.
- Details: the Rules / Remarks text as it is. Prizes: as it is.
- Overrides: Futsal gets Divisions Boys (its Prizes column says only boys). Mafia (Hidden Game) gets Active FALSE.
- Do not fix anything else silently. Write `IMPORT_NOTES.md` listing every problem you find. Known ones: Squid Game and Mafia have no category and no rules text. Feel the Beat and Mafia have no age group. Beaded Craft, Bedazzling, Trinket Tray Painting, 3D floral bloom and Mirror Painting reuse the Canvas Painting description. Carrom, Ludo and Chess share one Board Games description. All E-games share one generic description. Foosball says 1 to 2 players per side but is listed as Individual.

## 5. Business rules

The server is the authority. The browser repeats the checks only for speed and friendly messages.

**5.1 Entries and fees**

- One entry is one game, one age group, one division and one team, pair or individual.
- The fee is per entry, not per player. It is the same for every age group of a game.
- Early bird is active while server time (Asia/Karachi) is on or before EarlyBirdEndDate 23:59:59. The form accepts registrations while RegistrationOpen is TRUE and server time is on or before RegistrationCloseDate 23:59:59.
- Net total is the sum of the fee that applies to each entry. The server recalculates it. If the browser's `expectedTotal` differs, return `FEE_CHANGED` with the new numbers so the person can confirm. This covers someone who is mid-form at midnight on 10 December.
- When EarlyFee equals RegularFee, show one price with no strikethrough.

**5.2 Age groups and ID documents**

- Age is calculated on AgeCutoffDate. U19 means the player has not turned 19 on that date. In date terms, the date of birth must be after the cutoff date minus 19 years. Example with cutoff 2027-01-30: 2008-01-31 qualifies for U19 and 2008-01-30 does not. U17 and U15 work the same way.
- The entry's age group applies to every player in the entry. One player over the limit blocks the entry, and the message names that player.
- Date of birth is required for every player in every game.
- U19 and U17 entries: every player needs a CNIC or B-Form number (13 digits, shown as 12345-1234567-1) and one image or PDF of that document, uploaded separately from the payment proof. U15 and Open entries do not ask for ID.
- Reject the same ID number twice inside one entry.

**5.3 Players per entry.** Use MinPlayers and MaxPlayers from the Games tab. For team games, player 1 is the Captain and players beyond MinPlayers are labelled Extra.

**5.4 Divisions.** If a game offers Boys and Girls, the person picks one per entry. If it offers one, preselect it. If it is Open, ask nothing.

**5.5 Contact details.** Full name, role (Student, Parent or Teacher), WhatsApp number (Pakistani mobile in the form 03XXXXXXXXX or +923XXXXXXXXX, stored as 03XXXXXXXXX), email, and institution (school or college). The institution can be changed per entry.

**5.6 Capacity.** If MaxEntries is set and reached for a game, show Full on its card and block new entries for it.

**5.7 Duplicates.** Do not block. Add a note in the Entries Flags column when the same ID number, or the same name and date of birth, already appears in another entry for the same game.

## 6. Website experience

One page with steps and a progress indicator. No page reloads. Keep it to these screens:

**Landing.** Hero with the logo, event name, dates and venue, and a Register now button. An early bird chip shows the deadline and days left. Use the server time from the config response for countdowns, because phone clocks are often wrong. Show the SocialsNotice in a visible box. If AnnouncementBanner is set, show it at the top. If registration is closed or switched off, show a clear message and the event head contacts, and disable the form.

**Step 1, your details.** The contact fields from 5.5.

**Step 2, choose games.** Category tabs (All, Ground Games, Indoor Games, E-Games, Workshops, Other) and a search box. Each game card shows the name, a format chip (for example Team of 5 to 7, Singles, Doubles), the age group chips and the fee. Tap to add or remove. An info button opens Details and Prizes. A sticky bar at the bottom shows how many games are selected and the net total. During early bird, show the regular fee struck through next to the early fee. Show Full on games that reached MaxEntries.

**Step 3, teams and players.** One collapsible panel per selected game, one open at a time, with a tick when complete. Inside each panel:

- Age group chips (only the ones the game allows), the division, and the team name for team games.
- Player rows with name and date of birth (native date picker). For U19 and U17 entries, also the CNIC or B-Form number (auto-formatted with dashes) and a file upload with a thumbnail preview.
- An Add a player I already entered menu, so a student in several games is typed once and their ID image is uploaded once and reused. Use a `personKey` per person to track this.
- A live age check right after the date of birth is entered, in plain words: Ali was born on 2 March 2007, so he is over 18 on 30 January 2027. This entry is U19.

**Step 4, review and pay.**

- List every entry with its fee. While early bird is on, show the regular fee struck through and the early fee beside it.
- Show the subtotal at regular prices (struck through), the early bird saving, and the **Net total** in large type with a count-up animation. Label it Amount to transfer.
- A bank card with Bank, Account Title, IBAN and Amount, each with its own Copy button, plus Copy all. The button turns into a tick and a small toast says Copied. Use `navigator.clipboard` with an `execCommand` fallback for older browsers. Show the IBAN in groups of four (PK08 ALFH 0053 0010 1045 1307) but copy it without spaces. Copy all produces four lines: Bank, Account title, IBAN, Amount.
- Payment proof upload (required, image or PDF) and an optional transaction ID field.
- The SocialsNotice again, the ConsentText checkbox and a one-line privacy note saying what is collected and who sees it. Then the Submit button.

**Done.** Show the Submission ID with a copy button, the entry list, a Pending verification message, the event heads' call and WhatsApp links (`https://wa.me/` plus the number), a Print or save summary button (print stylesheet) and a Register another team button. Play a short celebration animation once.

**Behavior**

- Validate inline on blur and again on Next. Focus the first error. Error text says how to fix the problem.
- Never lose work. Save the draft to localStorage (text fields) and IndexedDB (compressed file blobs) on every change, restore it on reload, and clear it after success. Phones often reload a page when the person switches to the banking app and back, so test this. Show a small Progress saved note.
- Image handling in the browser: resize to at most 1600 px on the long edge, JPEG quality about 0.8, show a preview, allow remove and replace. PDFs pass through. Accept JPEG, PNG, WebP, PDF, and HEIC where the browser can decode it. Limit 5 MB after compression.
- Submit flow: upload files one at a time with a progress bar and 3 retries with backoff. Skip files already uploaded. Then send the final submit. Disable the button while it runs. The token makes retries safe.
- If the backend cannot be reached, say what happened, keep the draft and offer the event heads' WhatsApp links.
- Config loading: show a skeleton, render from the last good config cached in localStorage for speed, and refresh in the background.

## 7. Visual design

Take the colors from the poster. Define CSS variables:

- `--red-deep: #A00509` (top of the poster)
- `--red-orange: #C83806`
- `--orange: #E45C06` (brightest middle band)
- `--amber: #F8AA14`
- `--flame: #FFCE40`
- `--brown: #5C2600`
- `--brown-deep: #2D0C03`
- `--ink: #161012` (bottom of the poster)
- `--white: #FFFFFF`
- `--cream: #FFF8F0` (card surface, my addition)

Hero background, recreated in CSS because the poster is only 506 x 713 px: `linear-gradient(180deg, #A00509 0%, #C43307 22%, #D34507 36%, #E45C06 50%, #A04202 65%, #5C2600 79%, #2D0C03 93%, #161012 100%)`.

Contrast: white text only on #C83806 or darker (about 5 to 1). On #E45C06 or amber use #2D0C03 text, or large bold text only. Primary buttons are #C83806 with white text and #A00509 on hover. Focus rings are amber. Form cards are cream with ink text. The early bird price sits in an amber tag. The struck-through regular price is muted brown.

Typography: Anton for headings, skewed about -6 degrees with a layered dark text shadow to echo the 3D lettering on the poster. Poppins (400, 500, 600) for everything else. Two families only, `font-display: swap`.

Logo: it is white, so use it only on dark, red or orange backgrounds, never on cream cards. Make optimized copies (about 640 px wide PNG and WebP) in `assets/img/`. Make a favicon set (logo on an orange rounded square, 32, 180 and 512 px) and a 1200 x 630 Open Graph image (gradient, logo, name, dates). Add Open Graph and Twitter meta tags, because the link will be shared on WhatsApp.

Animation (transform and opacity only, smooth on cheap phones):

- Hero: slow gradient shift, up to 20 rising ember particles in CSS (paused when the tab is hidden), title slide-in.
- Cards: staggered fade-up on scroll with IntersectionObserver.
- Steps: slide and fade between steps, progress bar fill.
- Selecting a game: card lifts, a check mark pops, the price tag pulses once, the bottom bar total counts up.
- Early bird: the strikethrough draws across the regular price when it appears.
- Copy buttons: icon morphs into a tick.
- Success: a single burst of embers or confetti in brand colors.
- Respect `prefers-reduced-motion`: turn all of this off and keep instant state changes.

Accessibility: a label on every input, tap targets of at least 44 px, visible focus, `aria-live` for errors and toasts, full keyboard use, native inputs where possible.

Performance: first load under about 300 KB excluding fonts and logo. No heavy libraries. Lazy-load anything below the fold.

## 8. Backend API

Every response is `{"ok": true, ...}` or `{"ok": false, "code": "...", "message": "...", "fields": {...}}`.

**GET `?action=config`** returns public data only: event info, dates, server time and timezone, `earlyBirdActive`, `registrationOpen`, bank details, event head contacts, notices, consent text, and the active games without internal columns. For games with MaxEntries, include only a `full` boolean. Cache for 60 seconds in CacheService. Clear the cache when Config or Games is edited and from the menu.

**POST `upload`:** `{"action": "upload", "token": "...", "kind": "payment" or "id", "fileName": "...", "mimeType": "...", "data": "<base64>"}`. It returns `{"ok": true, "fileId": "..."}`. Check the MIME type against the allowed list and the magic bytes, check the size against MaxFileMB, and allow at most 40 files per token. Save into a pending folder named after the token.

**POST `submit`:**

```json
{
  "action": "submit",
  "token": "uuid-v4",
  "configLoadedAt": "server time from the config response",
  "website": "",
  "contact": {"name": "", "role": "Student", "whatsapp": "03001234567", "email": "", "institution": ""},
  "entries": [
    {
      "gameId": "G01",
      "ageGroup": "U19",
      "division": "Boys",
      "teamName": "",
      "institution": "",
      "players": [
        {"personKey": "p1", "name": "", "dob": "2009-04-12", "idNumber": "", "idFileId": ""}
      ]
    }
  ],
  "payment": {"proofFileId": "", "transactionId": "", "expectedTotal": 13500},
  "consent": true
}
```

Success response: `{"ok": true, "submissionId": "TSF3-0007", "feeType": "EARLY_BIRD", "total": 13500, "entries": [{"entryId": "TSF3-0007-01", "game": "Cricket", "fee": 6000}], "emailStatus": "SENT"}`.

Error codes: `NOT_OPEN`, `CLOSED`, `FEE_CHANGED` (includes the new total and per-entry fees), `VALIDATION_FAILED` (a `fields` map keyed by path such as `entries[0].players[2].dob`), `FILE_INVALID`, `GAME_FULL`, `RATE_LIMITED`, `BUSY`, `SERVER_ERROR`. A repeated token returns the original success response, so retries never create duplicates.

Submit steps, in this order:

1. Check the honeypot is empty, the form has been open at least 30 seconds by server time, and the rate limit allows it.
2. Validate everything against Games and Config.
3. Confirm every file ID sits in this token's pending folder. Never accept a file ID from anywhere else.
4. Take `LockService.getScriptLock()` (wait up to 30 seconds). Get the next Submission ID from a counter in Script Properties, not from the row count. Create the Drive folders, move and rename the files (if one file ID is used by several players, move it once and link the same file from every Players row), and write to Submissions, Entries and Players with one batch call per tab.
5. Release the lock. Send the email inside try/catch. A failure writes to Logs and sets EmailStatus to FAILED. It never fails the registration.
6. Return the result.

## 9. Security and privacy

- The public GET returns no registrations, files or personal data.
- Never trust the browser for prices, deadlines, age checks, game IDs, player counts or file IDs.
- Sheet formula injection: any text from the form that starts with `=`, `+`, `-` or `@` must be stored as plain text (leading apostrophe). Apply this to every cell the script writes.
- Files: allow JPEG, PNG, WebP and PDF only. Ignore client file names. Name files yourself, for example `TSF3-0007_payment.jpg` and `TSF3-0007_P03_id.jpg`.
- Drive: both root folders (TLH SF3 Payment Proofs and TLH SF3 ID Documents) stay private. Never set link sharing. Each registration gets a subfolder named with its Submission ID and the contact name.
- Rate limits in CacheService: at most 5 submissions per hour per WhatsApp number and per email.
- Logs never contain ID numbers or full dates of birth.
- No secrets in the repo. Add a `.gitignore`.
- Cloudflare Turnstile is a possible later add-on if spam appears. Do not build it now.

## 10. Admin features

- **Menu TLH Sports Fest:** Set up or repair workbook. Refresh website data (clears the cache). Resend confirmation email for the selected Submissions row. Delete test data (asks for confirmation, removes rows whose ContactName starts with TEST and their Drive folders).
- **Triggers** (installed by `setupWorkbook()`): an installable `onEdit` that clears the config cache when Config or Games change, and when PaymentStatus changes in Submissions it writes VerifiedAt, copies the status to the matching Entries rows, and sends the Verified or Rejected email (Rejected includes NoteToRegistrant). Also a daily time trigger that deletes pending uploads older than 48 hours.
- **Emails:** HTML with inline CSS in the brand colors and no remote images. Sender name TLH Sports Fest, reply-to the support email if one is set (otherwise the sending account). The confirmation lists the Submission ID, each entry, the net total, Pending verification status, the SocialsNotice and the event head contacts.

## 11. Testing

- Write the pricing and eligibility rules once in `shared/rules.js` as plain functions with no browser or Apps Script APIs. A script `scripts/sync-rules.js` copies them into `backend/Rules.gs` and `assets/js/rules.js`. A test fails if the copies differ.
- Unit tests with Node's built-in test runner. Required cases, using cutoff 2027-01-30:
  - Early bird: 2026-12-10 23:59:59 PKT is early bird. 2026-12-11 00:00:00 is regular. 2026-12-20 23:59:59 is open. 2026-12-21 00:00:00 is closed.
  - Age: U19 accepts 2008-01-31 and rejects 2008-01-30. U17 accepts 2010-01-31 and rejects 2010-01-30. U15 accepts 2012-01-31 and rejects 2012-01-30.
  - Totals: Cricket + Chess + Badminton (Doubles) is Rs 8,700 early bird and Rs 10,200 regular. Chess has equal fees, so no strikethrough.
  - ID number: 13 digits valid with or without dashes, 12 digits invalid.
  - WhatsApp: `+923001234567` and `0300-1234567` both normalize to `03001234567`.
  - Formula injection: a name like `=HYPERLINK(...)` is stored as text.
- Mock API: `USE_MOCK = true` in `config.js` (or `?mock=1`) runs the whole site with no backend. It simulates latency and every error code, including `FEE_CHANGED`. Build and test the frontend against it first.
- `TESTING.md`: a manual checklist for real phones. Cover a single player game, a multi-game submission, a team game with extra players, a U19 entry with an over-age player, a failed upload that recovers, a reload during the bank step, early bird expiring mid-form (use `TestNowOverride`), a closed form, and two submissions at the same moment.

## 12. Documentation

Write for a non-developer.

- `SETUP.md`: every click, in order. Create the Google account, create the Sheet, open Apps Script, paste or push the code, run `setupWorkbook()`, authorize, deploy as a web app, copy the URL into `config.js`, push to GitHub, turn on Pages, run a test registration.
- `ADMIN_GUIDE.md`: change the dates, change a fee, hide a game, verify and reject payments, find all players of a game, what to do on event day, who should have access to which Drive folder.
- `TROUBLESHOOTING.md`: CORS errors, changes not appearing (redeploy a new version), authorization errors, email quota errors.
- `README.md`, `DECISIONS.md` and `IMPORT_NOTES.md`.

## 13. Acceptance checklist

The work is done when all of these are true:

1. A visitor on a phone can register for three games in one submission in under five minutes.
2. The Sheet shows one Submissions row, three Entries rows and the matching Players rows, all with the same Submission ID.
3. The payment proof and every ID image are in private Drive folders, linked from the Sheet, and named with the Submission ID.
4. Changing `EarlyBirdEndDate`, `RegistrationCloseDate`, a fee or a bank detail in the Sheet changes the live site within about a minute, with no redeploy.
5. During early bird the form shows struck-through regular prices and the correct net total. After it, only regular prices.
6. A U19 or U17 entry cannot be submitted without a date of birth, an ID number and an ID image for every player. A player over the limit blocks the entry.
7. The Socials notice appears on the landing page, the review step, the success screen and the email.
8. Copy buttons work on iPhone Safari and Android Chrome.
9. Setting PaymentStatus to Verified updates the Entries rows and sends an email.
10. Reloading the page mid-form restores the draft.
11. A second Google account with no access cannot open any Drive file or the Sheet.
12. All unit tests pass. The mock mode works with no backend.

## 14. How to work

1. Read the CSV, logo and poster first. Reply with a short build plan and the decisions you made. Then build without waiting for approval.
2. Order: shared rules and tests, backend and setup function, mock API, frontend, integration, documentation. Run the tests after each stage.
3. You cannot reach my Google account, so you cannot test the live backend. Say clearly what you could not test.
4. Finish with a report: what works, what you could not test, and a numbered list of the manual steps I must do, in order.
