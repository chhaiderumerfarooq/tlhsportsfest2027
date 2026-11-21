# DECISIONS.md — Why we chose this

These are the big choices. Most come from `PROMPT.md`; the rest are decisions the
build made because the prompt says to keep it simple, and the decision record is
easier to review later.

## Site and stack

- **No build step, plain HTML/CSS/ES modules.** The frontend can be edited with a
  normal text editor and hosted directly from the repo root.
- **GitHub Pages from the repo root.** Relative paths and `.nojekyll` make the
  site work both on `username.github.io/repository-name/` and locally at
  `localhost:8080`.
- **Server is the authority.** The browser checks age and fees for speed only.
  It must still validate on the backend with the real rules, and it sends the
  server-returned new totals in `FEE_CHANGED` rather than continuing with its
  old estimate.
- **Mock by default until a URL is added.** `USE_MOCK = true` until you paste the
  Apps Script URL into `assets/js/config.js`. `?mock=1` forces mock for preview
  or tests.
- **Honeypot field in the form.** The hidden `website` input must stay empty.
- **Static, no cookies, no storage except the browser draft.** The public site
  does not write registration data to a browser store; personal details are only
  in the draft so the user can leave and come back.

## Games and entries

- **A person is shared through a `personKey`.** If the student is already in the
  form, the picker shows them; their ID photo and ID number are reused. The
  backend still receives the same file ID from every player row and moves the
  Drive file once.
- **We can have several entries per game.** One entry is one game, age group,
  division and team. If two teams need the same game, add another entry. The
  player pool is shared by design, so a student who plays in three games is
  typed once and their ID photo is uploaded once.
- **Age is live.** The form shows today's age on the cutoff date for the entry's
  age group. We put the real server time in `serverNow()` for the date picker.
- **Duplicate flags: same ID number, or same name+DOB in the same game.** We
  compute flags against existing entries and entries in the same submission, but
  the server does not block the user.
- **IDs: strict server validation.** U19/U17 players need a 13-digit ID number
  and one image/PDF, uploaded through the allowed flow. The frontend tells you the
  missing ID photo.

## Fees and capacity

- **Capacity counts entries, not players.** For full-game detection, the backend
  counts rows in the **Entries** tab whose `PaymentStatus` is not `Rejected` and
  compares them with the game `MaxEntries`. This is the number the registration
  team should use for room management: it counts people who are in teams, not
  how many players are included.
- **Uploads retry automatically.** Phone connections are unstable; the upload
  retries up to three times with backoff, and pressing Submit again after a
  network loss is still safe because of the token.

## Payments

- **The site does not talk about a fee-per-player.** The money already moved.
  The Bank card on the done screen shows Bank, Account Title, IBAN, and the total
  transferred. The confirmation email still says the same.
- **Bank data from the Sheet.** The site does not hardcode the bank. If the Sheet
  changes, the site reloads it from the cached config or fresh backend call.
- **Bank numbers are formatted.** IBAN display is grouped, but copy and the
  print summary use the plain string. Copy buttons turn to a tick and show a toast.

## Accounts and sharing

- **No automatic account creation.** People register using contact details. No
  setup is needed for visitors.
- **Drive folders are not shared.** No links to the folders appear on the site;
  access is for the event team and admitted admins. `README` and `ADMIN_GUIDE`
  explain who needs access and why.

## Performance and size

- **Inline SVG, system fonts, `Anton`/`Poppins` from Google Fonts.** First paint
  is close to 0. This keeps the total close to the prompt target.
- **No heavy libraries.** All rendering is custom.
- **`MOCK_GAMES` is only downloaded in mock mode.** The regular site downloads
  only the real `rules.js` and frontend modules.

## Accessibility

- **All taps are 44px or bigger.** We kept touch targets large.
- **Focus and live regions.** Errors focus the first invalid field and use
  `aria-live`. Toasts and the progress bar use live regions.
- **HTML5 inputs where possible.** Date pickers, switches and search are native.
- **Skip link and progress bar.** Screen readers can jump to the form; the
  progress bar is an accessible name for steps.
- **Avoid sounds.** The sheet says it "says often" rather than playing audio.

## Animations and visuals

- **Fake 3D-ness without heavy libraries.** `Hero` title is skewed with a dark
  shadow, `game-card` lifts on tap, the `early-chip` pulses, and `submission-id`
  springs up. Those are the main repeated animations.
- **Hover states.** Cards, menu and buttons do subtle, fast changes so motion is
  only for fun, never information.
- **Print layout:** Only the summary prints, not the whole registration form.

## Data flow

- **Form duration: 30 seconds minimum.** Not because we want to be slow, but
  because "Don't press Submit again while your bank app opens for 3 seconds."
- **Draft saved after each form change.** Text in localStorage and file blobs in
  IndexedDB. A reload restores everything.
- **Best-effort file saving.** If the device cannot store files, we show a note
  but let the user continue; if the network fails, the site retries the upload.

## Known deviations from the original spec

- **U16 and above is not age-restricted.** Only U19, U17, U15 have limits; any
  other age groups accept any DOB.
- **There is one agent-facing manifest:** `site.webmanifest` is for installers,
  and QR is used only as a link.
- **`Title` and `Descriptions` appear on the landing page.** We do not hardcode
  the event name string in many places; it is generated from the Sheet's names.

## Others

- **No code-server at build time.** Deployment is manual for now.
- **No Cloudflare Turnstile.** We can add it if spam appears.
- **Use `cache: no-store` only on config GET.** The config is cacheable by the
  app but not by the browser, so a day-old config cannot produce a wrong site.
- **The `Log` sheet is best-effort:** If the Sheet write fails, we still send the
  email. We do not block a registration because the log is broken.
