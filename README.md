# TLH Sports Fest 2027 — Official Registration System

A production-ready, full-stack registration system built for **TLH Sports Fest 2027** (hosted by **Genesis Educational Service Pvt Ltd.**).

The system consists of:
1. **Frontend**: Modern, responsive, single-page application hosted on **GitHub Pages**.
2. **Backend**: Serverless API powered by **Google Apps Script Web App** deployed via **Google Clasp**.
3. **Database**: Multi-tab **Google Spreadsheet** separating Individual and Team/Doubles registrations with live configuration.
4. **Media Storage**: Structured **Google Drive** storage with sensible, automated file naming for CNIC/B-Form verification and payment receipts.

---

## 🔗 Live Deployments & Key URLs

| Resource | URL / Identifier |
| :--- | :--- |
| **Live Frontend (GitHub Pages)** | [https://chhaiderumerfarooq.github.io/tlhsportsfest2027/](https://chhaiderumerfarooq.github.io/tlhsportsfest2027/) |
| **Backend Web App (Apps Script)** | [https://script.google.com/macros/s/AKfycbzNt73Jkh8oDNGHJw4QVbDCz188VZW8rbAzGu7gvVUDFqOclwoq1cQB7QG2RfHVWGaq/exec](https://script.google.com/macros/s/AKfycbzNt73Jkh8oDNGHJw4QVbDCz188VZW8rbAzGu7gvVUDFqOclwoq1cQB7QG2RfHVWGaq/exec) |
| **Google Spreadsheet Database** | [Google Sheets Link](https://drive.google.com/open?id=1sgOzBYvkJOzCz-sbqPLTp56QpsSuQw-qlVRVG4Hd-Q8) (`1sgOzBYvkJOzCz-sbqPLTp56QpsSuQw-qlVRVG4Hd-Q8`) |
| **Google Apps Script Project** | Script ID: `12x8FS60a9yjVRsjD1lVUMZqVnkOwUXdMpswyGnjNnPNMpj2uNPklUcvy` |
| **GitHub Repository** | `https://github.com/chhaiderumerfarooq/tlhsportsfest2027` |

---

## 🎨 Branding & Visual Identity

The interface adheres strictly to the official tournament branding palette and typography:

- **Fire Red (`#A30B0B`)**: Used for the header band, primary card accents, and key focus borders.
- **Burnt Orange (`#E8550C`)**: Used for the main gradient transitions, active radio states, and call-to-action buttons.
- **Amber / Gold (`#FFB020`)**: Used for countdown card borders, badges, fee highlights, and hover states.
- **Near-Black (`#140A06`)**: Page background and dark container panels.
- **Warm Off-White (`#FFF6EE`)**: Form body container background, ensuring high contrast and optimal readability.
- **Dark Text (`#2A1710`)**: Form input labels and values to prevent eye strain.
- **Typography**:
  - Headings: `Bebas Neue` & `Anton` (bold, condensed sports aesthetic).
  - Body & Labels: `Poppins` (clean geometric sans-serif).
- **Event Logo**: Integrated into the top navigation header (`Logo.png`).

---

## 📱 User Flow & Progressive Narrowing

To eliminate decision fatigue across 35 games, the registration form employs a **progressive disclosure** model:

```
[ Step 1: Gender ] ──> [ Step 2: Age Category ] ──> [ Step 3: Format ] ──> [ Step 4: Game Cards ]
 (Boys / Girls)          (U15 / U17 / U19)          (Individual / Team)      (Ground, Indoor,
                                                                              E-Games, Workshops)
```

1. **Step 1: Gender Selection** (`Boys` or `Girls`). Filters gender-restricted games (e.g., Foosball & Snooker Junior are Boys only).
2. **Step 2: Age Category** (`U15`, `U17`, `U19`). Filters events eligible for that age bracket.
3. **Step 3: Format Selection** (`Individual`, `Team`, or `Doubles`). Displays active counts of available events.
4. **Step 4: Categorized Game Selection**: Games and workshops render under clear category headers:
   - 🏃 Ground Games (Cricket, Futsal, Basketball, Paddle Tennis, Dodgeball, Frisbee, Squid Game)
   - 🏓 Indoor Games (Badminton, Table Tennis, Carrom, Ludo, Chess, Foosball, Arm Wrestling, Snooker Junior, Mafia)
   - 🎮 E-Games (PUBG Mobile, Tekken 8, FIFA 2027, Call of Duty PVP, Free Fire, Fortnite, Minecraft PVP)
   - 🎨 Workshops (Mud Pottery, Tote Bag Painting, Canvas Painting, Beaded Craft, Bedazzling, Trinket Tray, 3D Floral Bloom, Mirror Painting, Feel the Beat)
5. **Dynamic Roster Population**:
   - Selecting a game instantly creates the exact roster schema required:
     - **Cricket**: 7 core players + button to add up to 2 extra substitutes (Max 9).
     - **Futsal / Basketball**: 5 core players + button to add up to 2 extra substitutes (Max 7).
     - **Dodgeball**: 6 core players + button to add up to 2 extra substitutes (Max 8).
     - **Doubles**: Exactly 2 players (Captain & Player 2).
     - **Individual**: 1 participant.
   - For team games, dedicated inputs for **Team Name**, **School / Institution**, and **Chaperone Name & Contact** are required.
6. **Age-Aware Verification Policy**:
   - **U15**: Requires only the candidate's CNIC / B-Form number.
   - **U17 & U19**: Strict requirement — every player in the roster must provide both their CNIC / B-Form number **and** upload a clear verification photo.
7. **Banking & Fee Total**:
   - Account Title: `Genesis Educational Service Pvt Ltd.`
   - Bank: `Bank ALFALAH`
   - IBAN: `PK98ALFH0053001010451307`
   - One-click **"Copy Bank Details"** button with visual feedback.
   - Live fee card calculating Early Bird vs Regular pricing.
   - Payment proof screenshot upload with instant preview.
8. **Submission Confirmation**:
   - Instant on-screen summary modal with Registration ID.
   - Automated confirmation email sent to the participant / team captain.

---

## 🗄️ Google Drive Organization & Sensible File Naming

Uploaded documents and payment slips are sent directly to Google Drive via base64 API payloads and stored in a clear folder hierarchy:

```
TLH Sports Fest 2027 — Uploads/
├── CNIC & B-Form Photos/
│   ├── CNIC_Captain_U19_Cricket_Ahmed_Khan_3520112345671_20261124_052900.jpg
│   ├── CNIC_Player2_U19_Cricket_Bilal_Ali_3520198765431_20261124_052901.jpg
│   └── ...
└── Payment Receipts/
    ├── PAY_Cricket_Warriors_20261124_052900.jpg
    ├── PAY_Mud_Pottery_Sara_Ahmed_20261124_053500.jpg
    └── ...
```

### Sensible File Naming Convention
1. **CNIC / B-Form Uploads**:
   `CNIC_[Role]_[Age]_[Game]_[PlayerName]_[CNICNumber]_[YYYYMMDD_HHMMSS].[ext]`
   - Example: `CNIC_Captain_U19_Cricket_Ahmed_Khan_3520112345671_20261124_052900.jpg`
2. **Payment Receipts**:
   `PAY_[Game]_[TeamOrParticipantName]_[YYYYMMDD_HHMMSS].[ext]`
   - Example (Team): `PAY_Cricket_Warriors_20261124_052900.jpg`
   - Example (Solo): `PAY_Chess_Zaid_Malik_20261124_053100.jpg`

All files are created with public view permissions so administrative staff can click and verify proofs directly from the Google Sheet without requesting Google account permissions.

---

## 📊 Google Sheets Database Architecture

The backend workbook uses **four purpose-built tabs**:

### 1. `Individual_Registrations`
Stores all single-player registrations (Individual sports, E-games, Workshops).
| Col | Field | Description |
| :---: | :--- | :--- |
| 1 | `Registration ID` | Unique ID format: `TLH27-IND-XXXXXX` |
| 2 | `Timestamp` | Submission date and time |
| 3 | `Category` | Ground Games, Indoor, E-Games, or Workshops |
| 4 | `Event` | Game name |
| 5 | `Gender` | Boys / Girls |
| 6 | `Age Group` | U15, U17, U19 |
| 7 | `Participant Name` | Full name |
| 8 | `CNIC / B-Form` | CNIC format: `XXXXX-XXXXXXX-X` |
| 9 | `Phone` | Contact number |
| 10 | `Email` | Email address (receives confirmation) |
| 11 | `Date of Birth` | DOB (YYYY-MM-DD) |
| 12 | `School / College` | Institution name |
| 13 | `CNIC Photo URL` | Google Drive view URL (for U17/U19) |
| 14 | `Payment Receipt URL` | Google Drive view URL |
| 15 | `Fee Type` | Early Bird or Regular |
| 16 | `Fee Amount (PKR)` | Exact amount paid |
| 17 | `Payment Status` | Default: `Pending Verification` |
| 18 | `Verification Status` | Default: `Pending` |
| 19 | `Confirmation Email Sent`| `Yes` / `Failed` |
| 20 | `Admin Notes` | Free-form review field |

### 2. `Team_Registrations`
Stores all Team and Doubles registrations.
| Col | Field | Description |
| :---: | :--- | :--- |
| 1 | `Registration ID` | Unique ID format: `TLH27-TEAM-XXXXXX` |
| 2 | `Timestamp` | Submission date and time |
| 3 | `Category` | Category |
| 4 | `Event` | Game name |
| 5 | `Gender` | Boys / Girls |
| 6 | `Age Group` | U15, U17, U19 |
| 7 | `Team Name` | Team or Doubles pair name |
| 8 | `School / Institution` | School representing |
| 9 | `Chaperone / Coach` | Chaperone Name + Phone |
| 10 | `Captain Name` | Captain full name |
| 11 | `Captain CNIC` | Captain CNIC / B-Form |
| 12 | `Captain Phone` | Captain phone |
| 13 | `Captain Email` | Captain email |
| 14 | `Captain DOB` | Captain date of birth |
| 15 | `Captain CNIC URL` | Google Drive file URL |
| 16 | `Total Team Members` | Number of registered players |
| 17 | `Roster Details (JSON)` | Full array of players (name, role, cnic, dob, cnicUrl) |
| 18 | `Payment Receipt URL` | Google Drive file URL |
| 19 | `Fee Type` | Early Bird or Regular |
| 20 | `Total Fee Amount (PKR)`| Total team fee |
| 21 | `Payment Status` | `Pending Verification` |
| 22 | `Verification Status` | `Pending` |
| 23 | `Confirmation Email Sent`| `Yes` / `Failed` |
| 24 | `Admin Notes` | Free-form review field |
| 25 | `Last Updated` | Last modification timestamp |

### 3. `Games`
Lists all 35 official games with fields:
`Sr`, `Category`, `Event`, `Format`, `Gender`, `Age groups`, `Early Bird Fee`, `Normal Fee`, `Players / Team Size`, `Rules Summary`, `Min Players`, `Max Players`.

### 4. `Config`
Controls live system state without modifying code:
- `RegistrationOpen`: `true` or `false`
- `RegistrationDeadline`: Timestamp or date string (e.g. `2026-11-22T19:00:00.000Z`)
- `EarlyBirdOpen`: `true` or `false`
- `EarlyBirdDeadline`: Timestamp or date string (e.g. `2026-11-14T19:00:00.000Z`)
- `BankTitle`: Account title
- `BankName`: Bank name
- `BankAccount`: IBAN
- `UploadFolderId`: Auto-populated Drive folder ID

---

## ⚙️ Admin Controls & Dynamic Deadline Behavior

The system dynamically synchronizes backend configuration with the frontend UI:

### When Registrations Are Closed:
1. Setting `RegistrationOpen` to `FALSE` (or if current time surpasses `RegistrationDeadline`):
   - The backend `doGet` returns `"isRegistrationOpen": false`.
   - The frontend displays a prominent **Red Alert Banner**:
     > **REGISTRATIONS ARE CURRENTLY CLOSED**
     > The registration deadline for TLH Sports Fest 2027 has passed or entries have been paused by the tournament administration.
   - The entire form input area is automatically hidden and disabled.
   - The countdown card displays `00:00:00:00 EXPIRED / CLOSED`.
   - Backend `doPost` rejects any direct payload with HTTP 403 / `{ success: false, message: "Registrations are currently closed." }`.

### When Early Bird Has Expired:
1. Setting `EarlyBirdOpen` to `FALSE` (or if current time surpasses `EarlyBirdDeadline`):
   - The backend `doGet` returns `"isEarlyBirdOpen": false`.
   - All game cards immediately stop showing strike-through discounts and display standard regular pricing.
   - The Early Bird countdown card shows `00:00:00:00 CLOSED / EXPIRED`.
   - The summary fee calculator and backend fee evaluation record the regular fee.

---

## 🛠️ Developer Guide & Maintenance

### 1. Project Directory Structure
```
tlh sports fest 2027/
├── index.html           # Production frontend served by GitHub Pages
├── Logo.png             # Official tournament logo
├── frontend/            # Frontend working copy & local preview root
│   ├── index.html
│   └── Logo.png
├── backend/             # Google Apps Script source
│   ├── Code.js          # Consolidated Apps Script API & Drive logic
│   ├── appsscript.json  # Apps Script manifest
│   └── .clasp.json      # Clasp configuration linking to Script ID
├── README.md            # Comprehensive system documentation
└── .nojekyll            # Ensures GitHub Pages serves raw assets
```

### 2. Running Frontend Locally
To test the registration form on your local machine:
```bash
# Using Node.js http-server on port 5500
npx -y http-server -p 5500 --cors
```
Visit `http://localhost:5500` in your browser.

### 3. Deploying Backend with Google Clasp
When making edits to `backend/Code.js`:

```bash
cd backend

# Verify Clasp status
npx @google/clasp status

# Push changes to Google Apps Script
npx @google/clasp push

# Deploy a new immutable version
npx @google/clasp deploy --description "Update registration logic"
```

> **Important Note for Apps Script**:
> Ensure duplicate legacy `.gs` files are not present in the project to avoid function name collisions (`doGet`, `doPost`). All backend logic is unified in `backend/Code.js`.

### 4. Deploying Frontend to GitHub Pages
Root `index.html` is configured as the GitHub Pages entry point on branch `main`.
```bash
# Copy tested frontend to root
cp frontend/index.html index.html

# Stage, commit, and push
git add index.html frontend/index.html README.md backend/Code.js
git commit -m "Update registration system and documentation"
git push origin main
```
GitHub Pages deploys updates automatically within 60 seconds.

---

## 🔒 Security & Robustness Measures
- **Formula Injection Prevention**: Names, emails, and notes starting with `=`, `+`, `-`, or `@` are sanitized before writing to Google Sheets.
- **Payload Limits**: Image uploads are base64-encoded on client devices and transferred directly to Drive via chunked Apps Script blobs, preventing Google Sheets cell overflow limits.
- **CORS Handling**: `doGet` and `doPost` return responses using `ContentService.MimeType.JSON` with cross-origin safe headers.
- **Timer Cleanup**: Countdown timers clear active intervals before instantiating new cycles, preventing browser memory leaks and UI flicker.

---

*System maintained for Genesis Educational Service Pvt Ltd. — TLH Sports Fest 2027.*
