# ADMIN_GUIDE.md — Change something later

Use this guide from Google Drive with the **TLH Sports Fest 3.0** sheet open.
You need a Google account that can edit the Sheet. You do **not** need passwords
or API tokens; just Drive and the Sheet.

If you cannot find it, open `https://drive.google.com` with the account that
deployed the web app and search for **TLH Sports Fest 3.0**. The backend creates
it automatically on the first request.

## 1. Change an event date or venue

1. Open the **Config** tab.
2. Find the row: `EventDates`, `Venue`, or `Timezone`.
3. Change the **Value** cell to the new text, for example:

   ```
   EventDates = Sat 30 and Sun 31 January 2027
   Venue = TLH Canal Campus
   ```

4. The website picks this up in about a minute. No redeploy is needed.

Special rows:

- `RegistrationOpen`: keep `TRUE`; set to `FALSE` to close the form immediately.
- `EarlyBirdEndDate`: set to `2026-12-10`. After that, fees are the regular fees.
- `RegistrationCloseDate`: set to `2026-12-20`. On that day, through 23:59:59
  Pakistan time, registration is still open.
- `AgeCutoffDate`: set to `2027-01-30`. Ages are calculated on this date.
- `TestNowOverride`: fill in a date and time such as `2026-12-10 23:59:00` to
  preview the early-bird cutoff and the closing date. Clear it when done. The
  **Dashboard** shows a red warning while it is set.

## 2. Change a fee

1. Open the **Games** tab.
2. Find the row for the game.
3. Change **EarlyFee** or **RegularFee**.
4. If `EarlyFee == RegularFee`, both prices disappear from the site and only one
   price is shown.

The site rereads these values within about a minute. Old submissions keep the
fees they were verified with.

## 3. Hide or remove a game

1. In the **Games** tab, set **Active** to `FALSE` for that row.
2. The game disappears from new registrations.
3. If you want to restore it, set **Active** back to `TRUE`.
4. To remove a game completely, ask the development team; the seed data is
   imported and repair mode will recreate inactive entries if you are unsure.

`Mafia (Hidden Game)` is already `Active = FALSE` in the seed, so it is a
working example.

## 4. Verify a payment

Registrations live in **Team Games** and **Solo Games**, one row per entry. A
registration with more than one entry has several rows that share the same
`RegistrationID`.

1. Open **Team Games** or **Solo Games**.
2. Click into any row and type `Verified` or `Rejected` in the
   **PaymentStatus** dropdown (the cell already has a dropdown; typing the same
   values is also fine).
3. The script writes the time to **VerifiedAt** on every row of the group and
   sends an email to the registered email.

Notes:

- Editing **PaymentStatus** is the only thing that emails the person or changes
  the website. **AgeCheck** uses a separate dropdown, and **NoteToRegistrant**
  is text for the next status email, but setting it alone does nothing.
- You can set **PaymentStatus** back to **Pending** anytime. A status email
  fires each time the value actually changes.

To reject a payment:

1. Set **PaymentStatus** to `Rejected` as above.
2. Optionally type a note in **NoteToRegistrant**; the registrant receives it
   with the rejection email. Do not write anything sensitive in this cell;
   anything you type goes to the person.
3. Their Drive folder is not moved or deleted.

## 5. Find every player of a game

1. Open **Team Games** or **Solo Games**.
2. Press **Data > Create a filter** (or press **Filter** on the toolbar).
3. Set the filter on the **Game** column to the game name.
4. Each row shows the player columns filled in: `Player1Name`, `Player1DOB`,
   `Player1CNIC`, `Player1Age`, and so on. Blank cells are unused slots.

All rows of one registration repeat the same player data; there is no separate
player list tab.

## 6. Find a submission by ID

1. Open **Team Games** or **Solo Games**; use **Find** (Ctrl/Cmd+F) or scroll
   down.
2. Type the `TSF3-0007` RegistrationID into the browser's find box or sort by
   the **RegistrationID** column.
3. Double-click **NoteToRegistrant** or **AdminNotes** to edit those cells if
   needed.

The RegistrationID is unique: `TSF3-0007` appears on every row of the group.

## 6b. Resend a confirmation email

1. In the flat tab, click any row of the registration.
2. Choose **TLH Sports Fest > Resend confirmation email for selected row…**,
   or re-set **PaymentStatus** to `Verified` and back to `Pending` to trigger a
   status email.

## 6c. Menu helpers

**TLH Sports Fest** also offers:

- **Set payment status for selected rows…** — picks Pending, Verified or
  Rejected for every selected row (and every row of their registrations).
- **Set age check for selected rows…** — picks OK or Review.

## 7. What to do on event day

1. Confirm the Sheet is set to **Verified** for everyone you checked.
2. If a payment comes in late and needs manual review, look in
   **TLH SF3 Payment Proofs**. Each registration has a folder named
   `TSF3-0007 - Contact Name`.
3. Keep the site open while registering ends at **20 December 2026**.
4. After the event, re-open verified registrations or use the menu to resend
   anything missing.

## 8. Drive access

- Root folders: **TLH SF3 Payment Proofs** and **TLH SF3 ID Documents**.
- Each registration has a subfolder named `SubmissionID - ContactName`, for
  example `TSF3-0007 - Ayesha Khan`.
- Proofs and ID photos live inside those folders. Do not move or share them.

## 9. If something looks wrong

Read `TROUBLESHOOTING.md`. Common admin issues:

- The site shows old dates → clear the site's browser cache or press **Refresh
  website data** from the menu.
- A verified payment does not send the email → check **Logs** for
  `ERROR MailError`.
- An upload does not appear → check **Logs** and search for the SubmissionID.

## 10. Careful edits in this sheet

Do not type a number that begins with `=`, `+`, `-` or `@`; the script treats
that as a formula and will reject it. Type the value as text, for example
`=HYPERLINK(...)` typed as `'=HYPERLINK(...)` when needed.

Do not change script columns. Protected columns (marked with a warning shield)
hold timestamps, fees, proofs, folders and the flattened player slots. The
editable columns are:

- **PaymentStatus** (with the propagation behaviour above)
- **AgeCheck** (direct editing is preferred over the menu)
- **NoteToRegistrant** — text sent with the next status email
- **AdminNotes** — extra internal text
- TransactionID on new rows (whatever you type there)

In `Games`, you can change names, fees and text — that is the normal admin
workflow and the site picks it up within a minute.

In `Config`, use the `yyyy-mm-dd` form the site expects for the dates.
