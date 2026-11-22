# SETUP.md — Every click, in order

This file is for the event heads. It is written as a checklist; copy the steps
into Notes or a phone list. **Do not enter passwords or access tokens here or
in any chat with the registration system.** Where a step asks for a code, it is
the site of Google's consent screen or the Apps Script code in your sheet.

## 1. Create the Google Sheet (optional)

The backend creates the Sheet automatically on its first request, so this step
is optional. If you prefer to create it yourself:

1. Open `https://sheets.google.com` and sign in with the account that should
   own the system.
2. Create a new spreadsheet called **TLH Sports Fest 3.0**.
3. In the menu, press **Share**, then **Restricted**, and add:
   - your own account,
   - and the account you normally use to log in to Google Apps Script.
4. Do not add extra people unless needed.

The automatic Sheet is also called **TLH Sports Fest 3.0** and lives in the
Drive of the account that deploys the web app.

## 2. Open Apps Script

1. Open `https://script.google.com`.
2. On the left, click the new project icon, or if you have a project open, click
   **File > New > Apps Script**.
3. Give it the name **TLH Sports Fest 3.0 Backend**.

## 3. Paste the files (non-Clasp path)

The files to copy are:

```
backend/appsscript.json
backend/Utils.gs
backend/Rules.gs
backend/SeedGames.gs
backend/Workbook.gs
backend/Main.gs
backend/Emails.gs
```

1. In the Apps Script editor, on the left click the current project name and
   choose **Show manifest file**.
2. Replace its contents with `backend/appsscript.json`.
3. Add the other files. For each, in the Apps Script project:
   - Click the **+ New File** icon or press **File > New > App Script**.
   - Paste the contents of the file.
   - Set the file name: `Utils.gs`, `Rules.gs`, `SeedGames.gs`, `Workbook.gs`,
     `Main.gs`, `Emails.gs`.
4. Click **Save**, then press **Deploy > Create a new deployment** and **Done**
   (see §4).

This is the long path; use Clasp if you are comfortable with it (see README).

## 4. Run setupWorkbook()

You can skip this step: the first request to the deployed web app runs the same
setup automatically. Running it manually once is still useful because it shows
the authorisation prompt and any setup error in a readable dialog.

1. Back in the Apps Script editor, look for a custom menu item. If the project
   was just opened, you may need to click **Deploy > Install a debug deployment**
   and run from the menu, or simply:
2. Click **Run**, then choose `setupWorkbook`.
3. In the history panel, press **Authorize**, sign in to Google, and press
   **Allow**.

The script creates and repairs these tabs:

- `Config` (event dates, bank details, contacts)
- `Games` (35 seed games, all `Active = TRUE` except **Mafia (Hidden Game)**)
- `Submissions`, `Entries`, `Players`
- `Dashboard`, `Logs`

The menu **TLH Sports Fest > Set up or repair workbook** can be run again at any
time; it never deletes data.

Expected authorisation:

- **See and edit your data on Google Drive** — because the script creates folders.
- **View and manage your spreadsheets** — to read and write the Sheet.
- **Send email as you** — to send confirmation and status emails.
- **Verify your user information** — to use the account email.

That is every scope in `backend/appsscript.json`.

## 5. Deploy the web app

1. With the script open, click **Deploy > Get started > Web app** or
   **Deploy > Create a new deployment**.
2. Type a label such as `First deployment`.
3. Under **Execute as**, choose **Me (your name)**.
4. Under **Who has access**, choose **Anyone, including anonymous**.
5. Click **Deploy**.
6. Acknowledge the popup about anonymous access.
7. Copy the **Web App URL**. It looks like:

   ```
   https://script.google.com/d/<DEPLOYMENT_ID>/exec
   ```

   Keep this URL. Do not delete it while registrations are open.

If you want a new version later:

1. Edit the code.
2. Click **Deploy > Manage deployments**.
3. Find the TLH Sports Fest entry, click **Edit**.
4. Click **New version**, then **Deploy**.
5. The URL usually stays the same, but the new code takes a few minutes to run.

## 6. Put the URL into the site

The committed `assets/js/config.js` already points at the current deployment
and has `USE_MOCK = false`. If you create a **new** deployment:

1. Edit `assets/js/config.js`.
2. Replace `API_URL` with the URL you copied in §5.
3. Keep `USE_MOCK = false`.
4. Push the change to GitHub Pages.
5. Wait until the site is live, then run a test registration.

## 7. Test

Run through `TESTING.md` with a phone. Cover:

- A single-player game.
- A team game.
- A U19 entry.
- A reload during the bank step.
- The mock mode if needed.

## 8. If the process is stuck

- The first deploy may say **You do not have permission to perform this action**.
  Re-open Apps Script, run `setupWorkbook` again, and authorise.
- On **anyone, including anonymous**, if Google shows **Allow anonymous access?**
  press Allow; this is how visitors register without accounts.
- If the `Web App URL` changes or is deleted, repeat §5.
