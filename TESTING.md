# TESTING.md — Manual test checklist

Use a real phone when possible. Run this list:

1. **Lobby**
   - Load the site on mobile: heading, red hero, dates, **Register now**, early-bird
     chip, event heads with call/WhatsApp, notice about socials tickets.
   - Make the page full width; there should be no horizontal scroll on iPhone
     Safari or Android Chrome.
2. **Step 1 — details**
   - Fill name, role, WhatsApp, email, school.
   - Press **Continue**: no errors on a good name/email/phone.
3. **Step 2 — games**
   - Tap category tabs. **All**, **Ground Games**, **Indoor Games**, **E-Games**,
     **Workshops**, **Other** are available.
   - Search works for "Cricket", "Form", etc.
   - Add one game. The card is selected. Choose it again to add a second team of
     the same game. The sticky bar shows **2 entries selected Rs X,XXX**.
   - Press **Continue**.
4. **Step 3 — people**
   - For a single-player game, press **Add a new person**.
   - Add name and date of birth. Check the live age text on the cutoff date.
   - For U19, check ID number format and missing photo error.
   - Upload a photo or PDF through the dialog. On Android/iOS, pick from camera
     or gallery. Wait for the file to appear in the dialog.
   - For a U19 player, check ID number and ID photo are required.
   - Test **Add existing person**: add the same person in a second game; only
     one row is in the people list and reuse works.
   - Remove a player; the remove button shows a small modal.
   - Continue.
5. **Step 4 — pay**
   - Entry fee line for early bird is correct and struck regular price if any.
   - Bank card has Bank, Account Title, IBAN and **Amount to transfer**. Copy
     works on iPhone Safari and Android Chrome; the button becomes a tick.
   - Payment proof upload: choose screenshot or PDF. Use **Replace** to change
     the uploaded file after checking it.
6. **Mock errors**
   - In the mock panel, pick an error for next submit (`FEE_CHANGED`, `VALIDATION_FAILED`,
     `GAME_FULL`, `FILE_INVALID`, `RATE_LIMITED`, `BUSY`, `SERVER_ERROR`,
     `NOT_OPEN`, `CLOSED`) and press **Submit**. Read the message and try the
     action.
7. **FEE_CHANGED**
   - Set next submit to `FEE_CHANGED`. Press Submit. Check the new total and
     then change the payment amount and submit again.
8. **Registration closed**
   - Set server time to `2026-12-21 09:00:00` in mock. Close the form. Check
     that the lobby shows closed and form is disabled.
9. **Restart / resume**
   - Fill to step 3, close the phone or background it. Reload the tab. All your
     data should still be there.
10. **Second account**
    - In a different profile on the same phone or a second account, open the
      Drive root. It should not have your folders if Drive sharing is off.
11. **Dashboard and config changes**
    - In Sheet, change an EarlyBirdEndDate to a different date. Within about a
      minute, the site updates.
12. **Status email**
    - In Sheet, change `PaymentStatus` to `Verified`. Check that the confirmation
      email received earlier is still there and that the status email appears.
13. **Done screen**
    - Check Submission ID, registration ID, entry list, Save button, done
      summary, and the **Copy ID** button. Press **Register another team**; the
      contact details stay, but entries and payment details are cleared.
14. **No network**
    - Turn off Wi-Fi and press **Submit**. Check the error message is reasonable
      and that a later retry resumes.

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
