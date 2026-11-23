# TESTING.md — Manual test checklist

Use a real phone when possible. Run this list:

1. **Lobby**
   - Load the site on mobile: red hero, dates, **Register now**, early-bird
     chip, event heads with call/WhatsApp, notice about socials tickets.
   - Make the page full width; there should be no horizontal scroll on iPhone
     Safari or Android Chrome.
2. **Details at the top of the form**
   - Fill name, role, WhatsApp, email, school. All four sections stay visible.
3. **Games**
   - Tap category tabs. **All**, **Ground Games**, **Indoor Games**, **E-Games**,
     **Workshops**, **Other** are available; scroll right on mobile.
   - Search works for "Cricket", "Form", etc.
   - Add one game. The card is selected and shows a "+1" style badge; the bar
     shows **1 entry selected Rs X,XXX**. Choose a second team of the same game
     to see **2 entries selected**.
4. **People**
   - Entry cards are expanded already; no collapse steps needed.
   - For a single-player game, press **Add new person**.
   - Add name and date of birth. Check the live age text on the cutoff date.
   - For U19/U17, check ID number format and missing photo error.
   - Upload a photo or PDF through the dialog. On Android/iOS, pick from camera
     or gallery. Wait for the file to appear in the dialog.
   - Test **Add existing person**: add the same person in a second game; only
     one row is in the people list and reuse works.
   - Remove a player; the remove button shows a small modal.
   - **Save & add another** opens the dialog for the next player immediately.
   - The entry **Remove** button also asks for confirmation before deleting
     the row.
5. **Payment**
   - Entry fee line shows early-bird total, struck regular price if different.
   - Bank card shows Bank, Account Title, IBAN and **Amount to transfer**. Copy
     works on iPhone Safari and Android Chrome.
   - Payment proof upload: choose screenshot or PDF. Use **Replace** to change
     the uploaded file after checking it.
   - The submit button stays at the bottom of the payment section; the whole
     page is scrollable.
6. **Submit**
   - Check the consent box and confirm. Press **Submit registration**.
   - Mock errors: set the next submit result (`FEE_CHANGED`, `VALIDATION_FAILED`,
     `GAME_FULL`, `FILE_INVALID`, `RATE_LIMITED`, `BUSY`, `SERVER_ERROR`,
     `NOT_OPEN`, `CLOSED`) in the mock panel and press Submit. Read the message
     and try the action.
   - **FEE_CHANGED**: the new total appears in the bank card; submit again
     after confirming.
7. **Registration closed**
   - Set server time to `2026-12-21 09:00:00` in mock. Reload the page. The
     form is disabled and the notice says closed.
8. **Restart / resume**
   - Fill in details or games, close the phone or background the tab. Reload
     the tab. All your data should still be there; the header reads
     **Continue registration** and scrolls to your section.
9. **Second account**
   - In a different profile on the same phone or a second account, open the
     Drive root. It should not have your folders if Drive sharing is off.
10. **Dashboard and config changes**
    - In Sheet, change an EarlyBirdEndDate to a different date. Within about a
      minute, the site updates.
11. **Status email**
    - In the flat tab, type `Verified` in **PaymentStatus**, then set it back
      to `Pending` in the other row of the same group. Check the confirmation
      email received earlier is still there and the status email appears.
12. **Done screen**
    - Check Submission ID, entry list, totals and the **Copy ID** button.
    - Press **Register another team**; the contact details stay, entries and
      payment details are cleared.
13. **No network**
    - Turn off Wi-Fi and press **Submit**. Check the error message is
      reasonable and that a later retry resumes.

## Smoke test: a real submission lands in the sheet

Do this once with a throwaway contact name (e.g. `SF Test`) so the real
registrations stay clean, then run **Delete test data** as **TLH Sports Fest >
Delete test data** when done.

## Before manual tests

Run the unit tests:

```sh
npm test
```

And, if the environment changes:

```sh
npm run seed
npm run sync
npm run sync:check
```
