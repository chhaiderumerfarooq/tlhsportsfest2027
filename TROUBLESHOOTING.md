# TROUBLESHOOTING.md — Common problems and what to do

Do not guess when something fails: check the **Logs** tab first.

## Where are my registrations?

Registrations live in **Team Games** and **Solo Games**, one row per entry.
Look there; the **Dashboard** also shows counts by status. If the sheet is old,
look in **Archive - Submissions**, **Archive - Entries** and **Archive -
Players** — their rows were copied into the flat tabs.

## I cannot find the Google Sheet

The deployed backend creates the Sheet automatically the first time it receives
a request. It is called **TLH Sports Fest 3.0** and lives in the Google Drive of
the account that deployed the web app (the account that ran `clasp login` or
clicked **Deploy**).

1. Open `https://drive.google.com` with that account.
2. Search for **TLH Sports Fest 3.0**.
3. If it is still missing, open the Apps Script editor and run `setupWorkbook`
   once. Read the red error text if it fails.
4. If the Sheet exists but the site shows a server error, run
   **TLH Sports Fest > Refresh website data** and reload the site.

## The site looks stale, or new changes do not appear

1. Open the **Config** or **Games** tab, make one small change and save.
2. Click **Deploy > Manage deployments > Edit > New version > Deploy** and take
   the new deployment URL when you are asked. This is the usual fix for code
   changes that do not show up on the live site.
3. On the site, clear the browser cache (force reload on a phone), then re-open
   the page.
4. If the code changed in this build, publish a new **Deployment** from the
   Apps Script deployment manager (or push a new Pages build) — old drafts and
   analytics are unchanged, so republishing is safe.
5. If you are an admin, press **TLH Sports Fest > Refresh website data**.

## The flat tabs (`Team Games` / `Solo Games`) are missing

On the first request after a new backend is deployed, the script upgrades the
workbook: it creates the tabs, copies legacy rows from **Submissions**,
**Entries** and **Players**, and hides the old tabs as
**Archive - …**.

1. Reload the page and check **Logs** for `upgradeFlatSchema` errors.
2. If you see the error, run **TLH Sports Fest > Set up or repair workbook**
   and then refresh the site.

## The form says the browser is offline

This can happen if:

- The phone has no signal, Wi-Fi is off, or the network is unreliable.
- The site is a **progressive web app** while the mock is active; install or
  reject the install prompt, then try again.

Check your other apps. If Google Drive or Gmail is loading, the issue is
temporary. Try again in a few minutes.

## I cannot open the payment or ID Drive files

1. Make sure you are signed in to the same Google account that owns the Sheet.
2. Open `https://drive.google.com/drive/folders/` and find
   **TLH SF3 Payment Proofs** or **TLH SF3 ID Documents**. If you cannot see
   them, use the **Share** button on the sheet to ask the account owner.
3. If the root folders do not exist, run `setupWorkbook()` again.

## Emails are not arriving

1. Open **Logs**. Search for `submitEmail` or `statusEmail` and read the message.
2. Check the registrant's spam folder first.
3. In **Config**, check `SendConfirmationEmails` and `SendStatusEmails` are still
   `TRUE`.
4. Check that you did not change the account email in **Site and automation >
   Settings > User and allow lists** in Google Apps Script.

If the script is in a debug deployment, click **Deploy > Manage deployments** and
use the non-debug version.

## `you don't have permission` or `401` when the site calls the web app

This happens on the first few days sometimes.

1. Run `setupWorkbook` again in Apps Script and authorise again.
2. On the browser, press **Refresh** and sign in if needed.
3. If it still fails, press **Deploy > Create a new deployment** again and use the
   new URL in `assets/js/config.js`.

## The site says **CORS error**

The site sends POST requests as `text/plain;charset=utf-8`, which means the browser
does not ask for permission before the call. If you see a CORS error, make sure:

- `assets/js/config.js` points to the correct `/exec` URL.
- There is no trailing slash in a way that changes the URL you paste; the file
  uses the URL as given, ending in `/exec`.
- You are not testing through a reverse proxy that changes the origin. If you do,
  ask a developer to verify; this project prefers the direct `/exec` URL.

## Registration is not open but the site still shows the form

1. Make sure `RegistrationOpen` is `TRUE`.
2. Make sure `EarlyBirdEndDate` and `RegistrationCloseDate` are not set to an old
   date while the form is supposed to be open.
3. Clear **TestNowOverride**. A leftover date changes what the script thinks the
   time is.
4. Press **Refresh website data**, then reload the site.

## A U19 player has an ID number but the form rejects it

The form requires:

- A 13-digit CNIC or B-Form number. With dashes is fine, for example
  `35202-1234567-8`.
- One image or PDF of that number for every player. The photo must exist in the
  **ID Documents** Drive folder.
- For duplicate detection, the same number cannot be in two different people of
  the same entry.

If the photo is missing, press **Upload** again; a phone usually offers the
camera or the gallery.

## A payment proof fails with `FILE_INVALID`

1. Use a screenshot of the bank transfer or the bank's PDF.
2. The total on the screen, the total sent, and the total shown on your bank
   screen must be equal. If the fee changed because of early bird, the site
   says **Fee updated** and the new total is already copied into the bank card.
3. Make sure the file is at most 5 MB after compression. `MaxFileMB` in Config
   controls this; normally it is 5.
4. Compress the image to JPEG and take a new screenshot if the size is too large.

## I deleted the deployment or deleted it by mistake

1. Open the Apps Script project.
2. Click **Deploy > Get started > Web app**.
3. Make sure **Execute as** is **Me** and **Anyone, including anonymous** is
   selected.
4. Create the deployment and update the URL in `assets/js/config.js`.

## The site can't send the confirmation email

The Sheets can say **EmailStatus = Pending**, meaning the site accepted the
registration, but the email failed.

1. Open **Logs** and filter for `submitEmail`.
2. Common causes:
   - The account has hit the Gmail quota for the day. Wait and retry after a
     few hours from the admin menu.
   - The registrant's email address is invalid. The form checks this, but if
     you edited data in the sheet, ask them to update it.
3. Use **TLH Sports Fest > Resend confirmation email** for the submission.
4. The `emailStatus` can be `FAILED` when a mail fails. This does not delete the
   registration.

## Slow uploads on slow connections

If a student has a 2G/3G connection:

1. Use Wi-Fi if possible.
2. Restart the phone, or scroll up to the games section and reload the page.
   The draft is saved on the device, so work is not lost.
3. The site retries uploads up to three times.
4. If the phone loses signal after clicking Submit, open the form again and press
   Submit. The token prevents duplicates.

## Nothing shows on the Dashboard

If the **Dashboard** is blank, it usually means the script has not run since the
first deploy:

1. Open **Extensions > Apps Script**.
2. Run `setupWorkbook()` once.
3. In **Deploy > Get started > Web app**, click **Deploy**.
4. After a few seconds, refresh the browser.
5. Check **Logs** for `upgradeFlatSchema` failures if the sheets are missing.

If still empty after 10 minutes, call the event heads or open a ticket. The
system remains in the Apps Script project; reinstalling the workbook is not
destructive, but do it only after reading the warning inside `setupWorkbook()`.
