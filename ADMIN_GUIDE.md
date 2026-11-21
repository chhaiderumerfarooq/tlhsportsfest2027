# ADMIN_GUIDE.md — Change something later

Use this guide from Google Drive with the **TLH Sports Fest 3.0 — Registrations**
sheet open. You need a Google account that can edit the Sheet. You do **not** need
passwords or API tokens; just drive and the sheet.

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

1. Open **Submissions**.
2. Choose the row, press **Verify** in the **PaymentStatus** dropdown (or type
   `Verified`).
3. The script writes the time to **VerifiedAt**, copies the status to the
   matching **Entries** rows, and sends an email to the registered email.

To reject a payment:

1. Choose the row and set **PaymentStatus** to `Rejected`.
2. Optionally type a note in **InternalNotes** or **NoteToRegistrant**. The note
   text is sent to the registrant. Do not write anything sensitive in this cell;
   anything you type goes to the person.
3. The registrant receives an email and their Drive folder is not moved or
   deleted.

You can set **PaymentStatus** back to **Pending** anytime. Status changes are
the only way the site tells people about Verified or Rejected.

## 5. Find every player of a game

1. Open the **Players** tab.
2. Click the filter icon on the **Game** column header, or press
   **Data > Create a filter**, if it is not already active.
3. Type or select the game name. You get the list of full names and DOBs.
4. For a team entry, the **Roster** text in the **Entries** tab has one line per
   player: `1. Name (DOB)`, `2. Name (DOB)`.

## 6. Find a submission by ID

1. Open **Submissions**.
2. Use the search box on the top right, type the `TSF3-0000` ID, or sort by the
   **SubmissionID** column.
3. Double-click the cell to edit notes if needed.

The SubmissionID is unique: `TSF3-0007`, for example.

## 7. What to do on event day

1. Confirm the Sheet is set to **Verified** for everyone you checked.
2. If a payment comes in late and needs manual review, look in
   **TLH SF3 Payment Proofs**. Each registration has a folder named
   `TSF3-0007 - Contact Name`.
3. Keep the site open while registering ends at **20 December 2026**.
4. After the event, send any missing status emails from the menu or re-open
   verified submissions.

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

Do not change `Submissions` columns except in obvious ways. If you must
clear a column, ask a developer; the structure is used by the mail and export
code.
