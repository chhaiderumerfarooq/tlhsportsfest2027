// ============================================================
// TLH SPORTS FEST 2027 — Google Apps Script Backend
// Spreadsheet ID: 1sgOzBYvkJOzCz-sbqPLTp56QpsSuQw-qlVRVG4Hd-Q8
// ============================================================

const SPREADSHEET_ID = '1sgOzBYvkJOzCz-sbqPLTp56QpsSuQw-qlVRVG4Hd-Q8';
const SHEET_INDIVIDUAL_REG = 'Individual_Registrations';
const SHEET_TEAM_REG       = 'Team_Registrations';
const SHEET_GAMES          = 'Games';
const SHEET_CONFIG         = 'Config';

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error('Could not access spreadsheet: ' + err.message);
  }
}

function getOrCreateSheet(name, headers, headerColor = '#A30B0B') {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground(headerColor)
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getConfig';
    if (action === 'getConfig') {
      return jsonResponse(buildConfig());
    }
    if (action === 'setup') {
      setupSheets();
      return jsonResponse({ success: true, message: 'Setup completed successfully!' });
    }
    if (action === 'syncGames') {
      const result = syncGamesSheet();
      return jsonResponse(result);
    }
    if (action === 'fixFolders') {
      const folders = getUploadFolders();
      return jsonResponse({
        success: true,
        rootFolderId: folders.rootFolder.getId(),
        rootFolderName: folders.rootFolder.getName(),
        cnicFolderId: folders.cnicFolder.getId(),
        paymentFolderId: folders.paymentFolder.getId()
      });
    }
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message, stack: err.stack });
  }
}

function doPost(e) {
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action || 'register';

    if (action === 'register') {
      return jsonResponse(handleRegistration(payload));
    }
    if (action === 'uploadFile') {
      return jsonResponse(handleFileUpload(payload));
    }
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── Official Master Dataset matching user's exact specification ──
function getMasterGamesData() {
  return [
    // Ground Games
    [1, 'Cricket', 'Team', 'Ground Games', 'U19, U17, U15', 6000, 7000, '7 players + 2 extra', 'Fair bowling action; runs counted by scoring; outs decided by umpire; follow overs limit.', 'Team', 'Both', 7, 9],
    [2, 'Futsal', 'Team', 'Ground Games', 'U19, U17, U15', 6000, 7000, '5 players + 2 extra', 'No handball (except GK); limited contact; fixed time; fouls penalised. Two 10-min halves.', 'Team', 'Both', 5, 7],
    [3, 'Basketball', 'Team', 'Ground Games', 'U19, U17, U15', 6000, 7000, '5 players + 2 extra', 'No travelling or double dribble; follow time limits; fouls penalised; highest score wins.', 'Team', 'Both', 5, 7],
    [4, 'Paddle Tennis', 'Individual', 'Ground Games', 'U19, U17, U15', 2000, 2500, '1 player', 'Play within marked area; serve fairly; point awarded when opponent misses; follow score limit.', 'Individual', 'Both', 1, 1],
    [5, 'Paddle Tennis (Doubles)', 'Doubles', 'Ground Games', 'U19, U17, U15', 3500, 4500, '2 players', 'Play within marked area; serve fairly; point awarded when opponent misses; follow score limit.', 'Doubles', 'Both', 2, 2],
    [6, 'Dodgeball', 'Team', 'Ground Games', 'U19, U17, U15', 5000, 6000, '6 players', 'Two sides of 6 try to eliminate opponents by hitting with thrown balls or catching throws.', 'Team', 'Both', 6, 8],
    [7, 'Frisbee (Flying Disc)', 'Team', 'Ground Games', 'U19, U17, U15', 2000, 2500, '7 players', 'Ultimate Frisbee is a fast-paced, non-contact team sport with a flying disc. 7 players per team.', 'Team', 'Both', 7, 9],
    [8, 'Squid Game', 'Individual', 'Ground Games', 'U19', 700, 700, '1 player', 'Fun athletic survival elimination challenges.', 'Individual', 'Both', 1, 1],

    // Indoor Games
    [9, 'Badminton', 'Individual', 'Indoor Games', 'U19, U17, U15', 1000, 1500, '1 player', 'Serve diagonally; shuttle must pass net; rally scoring applies; no double hits.', 'Individual', 'Both', 1, 1],
    [10, 'Badminton (Doubles)', 'Doubles', 'Indoor Games', 'U19, U17, U15', 2000, 2500, '2 players', 'Serve diagonally; shuttle must pass net; rally scoring applies; no double hits.', 'Doubles', 'Both', 2, 2],
    [11, 'Table Tennis', 'Individual', 'Indoor Games', 'U19, U17, U15', 800, 1000, '1 player', 'Proper serve required; ball must bounce once each side; points on missed return.', 'Individual', 'Both', 1, 1],
    [12, 'Table Tennis (Doubles)', 'Doubles', 'Indoor Games', 'U19, U17, U15', 1200, 1500, '2 players', 'Proper serve required; ball must bounce once each side; points on missed return.', 'Doubles', 'Both', 2, 2],
    [13, 'Carrom', 'Individual', 'Indoor Games', 'Open Category', 500, 500, '1 player', 'Strike within turn; pocket queen with cover; fouls result in penalty.', 'Individual', 'Both', 1, 1],
    [14, 'Ludo', 'Individual', 'Indoor Games', 'Open Category', 500, 500, '1 player', 'Roll the dice fairly; move pieces according to number; no cheating.', 'Individual', 'Both', 1, 1],
    [15, 'Chess', 'Individual', 'Indoor Games', 'Open Category', 700, 700, '1 player', 'Standard moves; touch-move rule applies; checkmate ends the game.', 'Individual', 'Both', 1, 1],
    [16, 'Foosball', 'Individual', 'Indoor Games', 'U19, U17, U15', 500, 700, '1 player', 'Table soccer played on 4 rods per side. Knockout format to 10 goals.', 'Individual', 'Boys', 1, 1],
    [17, 'Arm Wrestling', 'Individual', 'Indoor Games', 'U19, U17, U15', 800, 1000, '1 player', 'Elbows on the table; fair grip; no lifting elbow; winner pins opponent hand.', 'Individual', 'Both', 1, 1],
    [18, 'Snooker Junior', 'Individual', 'Indoor Games', 'U15', 800, 1000, '1 player', 'Junior cue sport played with standard snooker rules.', 'Individual', 'Boys', 1, 1],
    [19, 'Mafia', 'Team', 'Indoor Games', 'U19', 500, 500, '4-8 players', 'Social deduction role-playing game played in teams / squads.', 'Team', 'Both', 4, 8],

    // E-Games
    [20, 'PUBG Mobile', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Assigned custom room modes; no emulator/hacking; moderator decision is final.', 'Individual', 'Both', 1, 1],
    [21, 'Tekken 8 (PS)', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Standard 1v1 tournament rules; default settings; best of 3 rounds.', 'Individual', 'Both', 1, 1],
    [22, 'FIFA 2027 (PS)', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Tactical defending; half length 5 mins; knockout format.', 'Individual', 'Both', 1, 1],
    [23, 'Call of Duty PVP (PS)', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Standard competitive multiplayer rules; no unfair advantages.', 'Individual', 'Both', 1, 1],
    [24, 'Free Fire Custom (Mobile)', 'Individual', 'E-Games', 'Open Category', 500, 700, '1 player', 'Mobile custom lobby; fair play rules apply.', 'Individual', 'Both', 1, 1],
    [25, 'Fortnite (PS)', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Custom lobby battle royale; standard tournament settings.', 'Individual', 'Both', 1, 1],
    [26, 'Minecraft PVP (PC)', 'Individual', 'E-Games', 'Open Category', 800, 1000, '1 player', 'Arena PVP duel format; vanilla mechanics; no hacked clients.', 'Individual', 'Both', 1, 1],

    // Workshops
    [27, 'Mud Pottery', 'Individual', 'Workshops', 'U19', 2000, 2500, '1 participant', 'Shaping clay into decorative or useful objects; materials provided.', 'Individual', 'Both', 1, 1],
    [28, 'Tote Bag Painting', 'Individual', 'Workshops', 'U19', 1000, 1000, '1 participant', 'Express ideas with colours and brushes on tote bags; materials provided.', 'Individual', 'Both', 1, 1],
    [29, 'Canvas Painting', 'Individual', 'Workshops', 'U19', 2000, 2500, '1 participant', 'Creative art on canvas; expresses creativity and fine motor skills.', 'Individual', 'Both', 1, 1],
    [30, 'Beaded Craft', 'Individual', 'Workshops', 'U19', 3000, 3500, '1 participant', 'Jewellery and beaded handicraft creations; all materials provided.', 'Individual', 'Both', 1, 1],
    [31, 'Bedazzling', 'Individual', 'Workshops', 'U19', 2000, 2500, '1 participant', 'Embellishing items with rhinestones and gems; materials provided.', 'Individual', 'Both', 1, 1],
    [32, 'Trinket Tray Painting', 'Individual', 'Workshops', 'U19', 2000, 2500, '1 participant', 'Decorative painting on ceramic/wooden trinket trays; all materials included.', 'Individual', 'Both', 1, 1],
    [33, '3D Floral Bloom', 'Individual', 'Workshops', 'U19', 2000, 2500, '1 participant', 'Sculptural 3D floral art on textured boards; guided instructions.', 'Individual', 'Both', 1, 1],
    [34, 'Mirror Painting', 'Individual', 'Workshops', 'U19', 2500, 3000, '1 participant', 'Glass and mirror painting techniques; take your customized mirror home.', 'Individual', 'Both', 1, 1],
    [35, 'Feel the Beat', 'Individual', 'Workshops', 'U19', 1500, 1500, '1 participant', 'Group music rhythm and drumming harmony activity. Relieves stress.', 'Individual', 'Both', 1, 1]
  ];
}

// ── Robust Helpers for Boolean & Date evaluation ──
function parseBoolValue(val, defaultVal = true) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === 'no' || s === '0' || s === 'closed' || s === 'close' || s === 'off') return false;
  if (s === 'true' || s === 'yes' || s === '1' || s === 'open' || s === 'on') return true;
  return defaultVal;
}

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

function buildConfig() {
  let config = {};
  let games = [];

  try {
    const configSheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
    const configData = configSheet.getDataRange().getValues();
    if (configData.length <= 1) {
      setupSheets();
      return buildConfig();
    }
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0]) config[configData[i][0]] = configData[i][1];
    }

    const gamesSheet = getOrCreateSheet(SHEET_GAMES, [
      'Sr', 'Game', 'Format', 'Category', 'AgeCategory',
      'EarlyFee', 'RegularFee', 'Players', 'Rules', 'Type', 'Gender', 'MinPlayers', 'MaxPlayers'
    ]);
    const gamesData = gamesSheet.getDataRange().getValues();
    for (let i = 1; i < gamesData.length; i++) {
      const row = gamesData[i];
      if (!row[1]) continue;
      games.push({
        sr: row[0],
        game: row[1],
        format: row[2],
        category: row[3],
        ageCategory: String(row[4] || ''),
        earlyFee: Number(row[5]) || 0,
        regularFee: Number(row[6]) || 0,
        players: row[7],
        rules: row[8],
        type: row[9] || 'Individual',
        gender: row[10] || 'Both',
        minPlayers: Number(row[11]) || 1,
        maxPlayers: Number(row[12]) || 1,
        isTeamGame: String(row[9]).toLowerCase() === 'team' || String(row[9]).toLowerCase() === 'doubles'
      });
    }
  } catch (err) {
    Logger.log('Using fallback config: ' + err.message);
  }

  if (games.length === 0) {
    const master = getMasterGamesData();
    games = master.map(row => ({
      sr: row[0],
      game: row[1],
      format: row[2],
      category: row[3],
      ageCategory: String(row[4] || ''),
      earlyFee: Number(row[5]) || 0,
      regularFee: Number(row[6]) || 0,
      players: row[7],
      rules: row[8],
      type: row[9],
      gender: row[10],
      minPlayers: row[11],
      maxPlayers: row[12],
      isTeamGame: row[9] === 'Team' || row[9] === 'Doubles'
    }));
  }

  const now = new Date();

  // Evaluate Registration Open
  let isRegOpen = parseBoolValue(config['RegistrationOpen'], true);
  const regDeadline = parseDateValue(config['RegistrationDeadline']);
  if (regDeadline && now > regDeadline) {
    isRegOpen = false;
  }

  // Evaluate Early Bird Open
  let isEbOpen = parseBoolValue(config['EarlyBirdOpen'], true);
  const ebDeadline = parseDateValue(config['EarlyBirdDeadline']);
  if (ebDeadline && now > ebDeadline) {
    isEbOpen = false;
  }

  return {
    success: true,
    games: games,
    isRegistrationOpen: isRegOpen,
    isEarlyBirdOpen: isEbOpen,
    bankTitle: config['BankTitle'] || 'Genesis Educational Service Pvt Ltd.',
    bankName: config['BankName'] || 'Bank ALFALAH',
    bankAccount: config['BankAccount'] || 'PK98ALFH0053001010451307',
    earlyBirdDeadline: config['EarlyBirdDeadline'] ? (config['EarlyBirdDeadline'] instanceof Date ? config['EarlyBirdDeadline'].toISOString() : String(config['EarlyBirdDeadline'])) : '',
    registrationDeadline: config['RegistrationDeadline'] ? (config['RegistrationDeadline'] instanceof Date ? config['RegistrationDeadline'].toISOString() : String(config['RegistrationDeadline'])) : '',
    eventName: config['EventName'] || 'TLH SPORTS FEST 2027',
    eventTagline: config['EventTagline'] || 'Ignite the Spirit of Sports 🔥',
    uploadFolderId: String(config['UploadFolderId'] || PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID') || '').trim()
  };
}

function getMaxAgeForCategory_(ageCategory) {
  const s = String(ageCategory || '').trim().toUpperCase();
  if (s === 'U15') return 15;
  if (s === 'U17') return 17;
  if (s === 'U19' || s === 'OPEN' || s === 'OPEN CATEGORY') return 19;
  return null;
}

function parseAgeYears_(val) {
  if (val === undefined || val === null || val === '') return null;
  const s = String(val).trim();
  if (/^\d{1,2}$/.test(s)) return Number(s);
  let d = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    d = new Date(s);
  }
  if (!d || isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

// ── TWO SEPARATE SHEETS FOR REGISTRATIONS ──
function handleRegistration(payload) {
  const config = buildConfig();

  // Enforce Registration Closed check
  if (!config.isRegistrationOpen) {
    return {
      success: false,
      error: 'Online registrations for TLH Sports Fest 2027 are officially closed.'
    };
  }

  // Enforce Age Category maximum age limit (e.g. Open Category max 19 years)
  const maxAge = getMaxAgeForCategory_(payload.ageCategory);
  if (maxAge !== null) {
    const captainAge = parseAgeYears_(payload.dob);
    if (captainAge !== null && captainAge > maxAge) {
      return {
        success: false,
        error: `Maximum accepted age for ${payload.ageCategory} is ${maxAge} years (entered age: ${captainAge}).`
      };
    }
    if (Array.isArray(payload.teamMembers)) {
      for (let i = 0; i < payload.teamMembers.length; i++) {
        const mAge = parseAgeYears_(payload.teamMembers[i].ageOrDob);
        if (mAge !== null && mAge > maxAge) {
          return {
            success: false,
            error: `Player "${payload.teamMembers[i].name || '#' + (i + 1)}" exceeds the maximum accepted age (${maxAge} years) for ${payload.ageCategory}.`
          };
        }
      }
    }
  }

  const isTeam = (payload.format === 'Team' || payload.format === 'Doubles' || payload.isTeamGame === true);
  const now = new Date();
  const isEarlyBird = config.isEarlyBirdOpen;
  const feePaid = isEarlyBird ? payload.earlyFee : payload.regularFee;

  let regId = '';

  if (isTeam) {
    // ── TEAM & DOUBLES REGISTRATION SHEET ──
    const teamHeaders = [
      'Timestamp', 'Reg ID', 'Event / Game', 'Format', 'Category', 'Gender', 'Age Category',
      'Team Name', 'School / Institution', 'Chaperone / Coach',
      'Captain Name', 'Captain DOB / Age', 'Captain Phone', 'Captain Email',
      'Captain CNIC', 'Captain CNIC Photo URL',
      'Total Squad Count', 'Complete Squad Roster Summary',
      'Payment Proof URL', 'Early Fee', 'Regular Fee', 'Fee Paid', 'Pricing Tier',
      'Verification Status', 'Email Sent'
    ];
    const teamSheet = getOrCreateSheet(SHEET_TEAM_REG, teamHeaders, '#E8550C');

    regId = 'TLH-TEAM-' + Utilities.formatDate(now, 'Asia/Karachi', 'yyyyMMdd') + '-' + 
            String(teamSheet.getLastRow()).padStart(4, '0');

    // Build Roster Summary
    let membersSummary = '';
    const squadCount = (payload.teamMembers && payload.teamMembers.length) || 1;
    if (payload.teamMembers && payload.teamMembers.length) {
      membersSummary = payload.teamMembers.map((m, idx) => {
        let line = `${idx + 1}. [${m.role || 'Player'}] ${m.name || 'N/A'} (DOB/Age: ${m.ageOrDob || 'N/A'}, CNIC: ${m.cnic || 'N/A'}`;
        if (m.cnicUrl) line += `, CNIC Doc: ${m.cnicUrl}`;
        line += ')';
        return line;
      }).join('\n');
    }

    const row = [
      now,
      regId,
      payload.game || '',
      payload.format || 'Team',
      payload.category || '',
      payload.gender || '',
      payload.ageCategory || '',
      payload.teamName || '',
      payload.school || '',
      payload.chaperone || '',
      payload.name || '',
      payload.dob || '',
      payload.phone || '',
      payload.email || '',
      payload.cnicNumber || '',
      payload.cnicImageUrl || '',
      squadCount,
      membersSummary,
      payload.paymentProofUrl || '',
      payload.earlyFee || 0,
      payload.regularFee || 0,
      feePaid,
      isEarlyBird ? 'Early Bird Discount 🐦' : 'Regular Fee',
      'Pending Payment Verification',
      'No'
    ];

    teamSheet.appendRow(row);

    // Send confirmation email
    let emailSent = false;
    if (payload.email) {
      try {
        sendTeamConfirmationEmail(payload, regId, feePaid, isEarlyBird);
        emailSent = true;
        const lastRow = teamSheet.getLastRow();
        teamSheet.getRange(lastRow, 25).setValue('Yes');
      } catch (e) {
        Logger.log('Team confirmation email error: ' + e.message);
      }
    }

    return {
      success: true,
      regId: regId,
      type: 'Team',
      feePaid: feePaid,
      isEarlyBird: isEarlyBird,
      emailSent: emailSent,
      message: 'Team registration submitted successfully!'
    };

  } else {
    // ── INDIVIDUAL REGISTRATION SHEET ──
    const indHeaders = [
      'Timestamp', 'Reg ID', 'Event / Game', 'Category', 'Format', 'Gender', 'Age Category',
      'Participant Name', 'Date of Birth', 'Phone / WhatsApp', 'Email Address', 'School / Institution',
      'CNIC / B-Form Number', 'CNIC Photo URL', 'Payment Proof URL',
      'Early Fee', 'Regular Fee', 'Fee Paid', 'Pricing Tier',
      'Verification Status', 'Email Sent'
    ];
    const indSheet = getOrCreateSheet(SHEET_INDIVIDUAL_REG, indHeaders, '#A30B0B');

    regId = 'TLH-IND-' + Utilities.formatDate(now, 'Asia/Karachi', 'yyyyMMdd') + '-' + 
            String(indSheet.getLastRow()).padStart(4, '0');

    const row = [
      now,
      regId,
      payload.game || '',
      payload.category || '',
      payload.format || 'Individual',
      payload.gender || '',
      payload.ageCategory || '',
      payload.name || '',
      payload.dob || '',
      payload.phone || '',
      payload.email || '',
      payload.school || '',
      payload.cnicNumber || '',
      payload.cnicImageUrl || '',
      payload.paymentProofUrl || '',
      payload.earlyFee || 0,
      payload.regularFee || 0,
      feePaid,
      isEarlyBird ? 'Early Bird Discount 🐦' : 'Regular Fee',
      'Pending Payment Verification',
      'No'
    ];

    indSheet.appendRow(row);

    // Send confirmation email
    let emailSent = false;
    if (payload.email) {
      try {
        sendIndividualConfirmationEmail(payload, regId, feePaid, isEarlyBird);
        emailSent = true;
        const lastRow = indSheet.getLastRow();
        indSheet.getRange(lastRow, 21).setValue('Yes');
      } catch (e) {
        Logger.log('Individual confirmation email error: ' + e.message);
      }
    }

    return {
      success: true,
      regId: regId,
      type: 'Individual',
      feePaid: feePaid,
      isEarlyBird: isEarlyBird,
      emailSent: emailSent,
      message: 'Individual registration submitted successfully!'
    };
  }
}

// ── Email for Individual ──
function sendIndividualConfirmationEmail(data, regId, feePaid, isEarlyBird) {
  const subject = `🔥 TLH Sports Fest 2027 Registration Receipt [${regId}]`;

  const html = `
  <div style="font-family:'Poppins',Arial,sans-serif;max-width:620px;margin:0 auto;background:#FFF6EE;border-radius:12px;overflow:hidden;border:1px solid #e8cbb5;">
    <div style="background:linear-gradient(135deg,#A30B0B,#E8550C,#FFB020);padding:28px 20px;text-align:center;">
      <h1 style="color:#FFFFFF;font-size:26px;margin:0;letter-spacing:2px;">TLH SPORTS FEST 2027</h1>
      <p style="color:#FFF6EE;font-size:13px;margin:6px 0 0;font-weight:500;">Individual Participant Registration Receipt</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#2A1710;font-size:15px;margin-top:0;">Dear <strong>${data.name}</strong>,</p>
      <p style="color:#2A1710;font-size:13px;line-height:1.5;">Thank you for registering for <strong>TLH Sports Fest 2027</strong>! Your submission has been recorded under Registration ID <strong style="color:#A30B0B;">${regId}</strong>.</p>
      
      <div style="background:#FFFFFF;border-radius:8px;border:1px solid #E8550C33;overflow:hidden;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#2A1710;">
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;width:40%;">Registration ID</td><td style="padding:8px 12px;font-weight:700;">${regId}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Event / Game</td><td style="padding:8px 12px;font-weight:700;">${data.game}</td></tr>
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Category</td><td style="padding:8px 12px;">${data.category} (${data.format || 'Individual'})</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Age Bracket & Gender</td><td style="padding:8px 12px;">${data.ageCategory} (${data.gender})</td></tr>
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Participant Name</td><td style="padding:8px 12px;">${data.name}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">School / Institution</td><td style="padding:8px 12px;">${data.school || '-'}</td></tr>
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Fee Status</td><td style="padding:8px 12px;font-weight:700;color:#2E7D32;">Rs. ${Number(feePaid).toLocaleString()} ${isEarlyBird ? '(Early Bird Discount 🐦)' : '(Regular Fee)'}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Verification Status</td><td style="padding:8px 12px;color:#E8550C;font-weight:600;">Pending Payment Verification</td></tr>
        </table>
      </div>
      
      <div style="background:#fff4d9;border-left:4px solid #FFB020;padding:12px;border-radius:4px;margin-top:16px;">
        <p style="margin:0;font-size:12px;color:#704800;line-height:1.4;">
          <strong>Next Steps:</strong> The management team is reviewing your payment screenshot and age credentials. You will receive official match fixtures and schedules shortly.
        </p>
      </div>
    </div>
    <div style="background:#140A06;padding:14px;text-align:center;">
      <p style="color:#FFF6EE;font-size:11px;margin:0;">TLH Sports Fest 2027 • Genesis Educational Services Pvt Ltd.</p>
    </div>
  </div>`;

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: html
  });
}

// ── Email for Team & Doubles ──
function sendTeamConfirmationEmail(data, regId, feePaid, isEarlyBird) {
  const subject = `🔥 TLH Sports Fest 2027 Team Registration [${regId}] — ${data.teamName || data.game}`;

  let membersTableRows = '';
  if (data.teamMembers && data.teamMembers.length) {
    data.teamMembers.forEach((m, i) => {
      membersTableRows += `
        <tr style="border-bottom:1px solid #ebd9cd;">
          <td style="padding:6px 10px;font-size:12px;color:#666;">#${i+1} [${m.role || 'Player'}]</td>
          <td style="padding:6px 10px;font-size:12px;font-weight:600;">${m.name}</td>
          <td style="padding:6px 10px;font-size:12px;color:#555;">Age/DOB: ${m.ageOrDob || '-'}</td>
          <td style="padding:6px 10px;font-size:12px;color:#555;">CNIC: ${m.cnic || '-'}</td>
        </tr>
      `;
    });
  }

  const html = `
  <div style="font-family:'Poppins',Arial,sans-serif;max-width:640px;margin:0 auto;background:#FFF6EE;border-radius:12px;overflow:hidden;border:1px solid #e8cbb5;">
    <div style="background:linear-gradient(135deg,#A30B0B,#E8550C,#FFB020);padding:28px 20px;text-align:center;">
      <h1 style="color:#FFFFFF;font-size:26px;margin:0;letter-spacing:2px;">TLH SPORTS FEST 2027</h1>
      <p style="color:#FFF6EE;font-size:13px;margin:6px 0 0;font-weight:500;">Official Team / Squad Registration Receipt</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#2A1710;font-size:15px;margin-top:0;">Dear Captain <strong>${data.name}</strong>,</p>
      <p style="color:#2A1710;font-size:13px;line-height:1.5;">Your team <strong>"${data.teamName || data.game}"</strong> has been successfully registered for <strong>${data.game}</strong> at TLH Sports Fest 2027 under Registration ID <strong style="color:#A30B0B;">${regId}</strong>.</p>
      
      <div style="background:#FFFFFF;border-radius:8px;border:1px solid #E8550C33;overflow:hidden;margin:16px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#2A1710;">
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;width:40%;">Registration ID</td><td style="padding:8px 12px;font-weight:700;">${regId}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Team Name</td><td style="padding:8px 12px;font-weight:700;color:#E8550C;">${data.teamName}</td></tr>
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Event / Sport</td><td style="padding:8px 12px;font-weight:700;">${data.game} (${data.format})</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Age Bracket & Gender</td><td style="padding:8px 12px;">${data.ageCategory} (${data.gender})</td></tr>
          <tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">School / Institution</td><td style="padding:8px 12px;">${data.school || '-'}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Captain Contact</td><td style="padding:8px 12px;">${data.name} • ${data.phone}</td></tr>
          ${data.chaperone ? `<tr style="background:#A30B0B11;"><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Chaperone / Coach</td><td style="padding:8px 12px;">${data.chaperone}</td></tr>` : ''}
          <tr><td style="padding:8px 12px;font-weight:600;color:#A30B0B;">Fee Status</td><td style="padding:8px 12px;font-weight:700;color:#2E7D32;">Rs. ${Number(feePaid).toLocaleString()} ${isEarlyBird ? '(Early Bird Discount 🐦)' : '(Regular Fee)'}</td></tr>
        </table>
      </div>

      <div style="margin:16px 0;">
        <h4 style="font-size:13px;color:#A30B0B;margin:0 0 6px;">Squad Roster Details (${(data.teamMembers && data.teamMembers.length) || 0} Players):</h4>
        <div style="background:#FFFFFF;border-radius:6px;border:1px solid #ebd9cd;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            ${membersTableRows}
          </table>
        </div>
      </div>
      
      <div style="background:#fff4d9;border-left:4px solid #FFB020;padding:12px;border-radius:4px;margin-top:16px;">
        <p style="margin:0;font-size:12px;color:#704800;line-height:1.4;">
          <strong>Next Steps:</strong> Team documents and payment proof are under review. Fixtures, captain briefing links, and schedule brackets will be emailed prior to the event.
        </p>
      </div>
    </div>
    <div style="background:#140A06;padding:14px;text-align:center;">
      <p style="color:#FFF6EE;font-size:11px;margin:0;">TLH Sports Fest 2027 • Genesis Educational Services Pvt Ltd.</p>
    </div>
  </div>`;

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: html
  });
}

// ── Google Drive Folder & Sensible File Naming ──
function getUploadFolders() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const props = PropertiesService.getScriptProperties();
    let rootFolderId = '';
    let configSheet = null;
    let firstUploadRow = -1;
    const duplicateRows = [];

    try {
      configSheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
      const data = configSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === 'UploadFolderId') {
          if (firstUploadRow === -1) {
            firstUploadRow = i + 1;
          } else {
            duplicateRows.push(i + 1);
          }
          const candidateId = String(data[i][1] || '').trim();
          if (candidateId && !rootFolderId) {
            rootFolderId = candidateId;
          }
        }
      }
    } catch (e) {}

    if (!rootFolderId) {
      rootFolderId = String(props.getProperty('UPLOAD_FOLDER_ID') || '').trim();
    }

    let rootFolder = null;
    if (rootFolderId) {
      try {
        const candidate = DriveApp.getFolderById(rootFolderId);
        if (candidate && !candidate.isTrashed()) {
          rootFolder = candidate;
        }
      } catch (e) {}
    }

    // Reuse existing folder by name if Config/Properties was lost or blank
    if (!rootFolder) {
      const existing = DriveApp.getFoldersByName('TLH Sports Fest 2027 — Uploads');
      while (existing.hasNext()) {
        const f = existing.next();
        if (!f.isTrashed()) {
          rootFolder = f;
          break;
        }
      }
    }

    // Only create a new folder if none exists anywhere
    if (!rootFolder) {
      rootFolder = DriveApp.createFolder('TLH Sports Fest 2027 — Uploads');
      rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    const finalFolderId = rootFolder.getId();
    props.setProperty('UPLOAD_FOLDER_ID', finalFolderId);

    // Update the single UploadFolderId row in-place & clean up duplicate rows
    try {
      if (configSheet) {
        if (firstUploadRow !== -1) {
          configSheet.getRange(firstUploadRow, 2).setValue(finalFolderId);
        } else {
          configSheet.appendRow(['UploadFolderId', finalFolderId]);
        }
        for (let r = duplicateRows.length - 1; r >= 0; r--) {
          configSheet.deleteRow(duplicateRows[r]);
        }
      }
    } catch (e) {}

    // Subfolders: CNIC & Payment (non-trashed reuse)
    let cnicFolder = null;
    const cnicSubs = rootFolder.getFoldersByName('CNIC & B-Form Photos');
    while (cnicSubs.hasNext()) {
      const f = cnicSubs.next();
      if (!f.isTrashed()) { cnicFolder = f; break; }
    }
    if (!cnicFolder) {
      cnicFolder = rootFolder.createFolder('CNIC & B-Form Photos');
      cnicFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    let paymentFolder = null;
    const paySubs = rootFolder.getFoldersByName('Payment Receipts');
    while (paySubs.hasNext()) {
      const f = paySubs.next();
      if (!f.isTrashed()) { paymentFolder = f; break; }
    }
    if (!paymentFolder) {
      paymentFolder = rootFolder.createFolder('Payment Receipts');
      paymentFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    return { rootFolder, cnicFolder, paymentFolder };
  } finally {
    lock.releaseLock();
  }
}

function handleFileUpload(payload) {
  const { cnicFolder, paymentFolder } = getUploadFolders();
  const isCnic = (payload.fileType === 'cnic' || payload.fileType === 'member_cnic');
  const targetFolder = isCnic ? cnicFolder : paymentFolder;

  // Generate Sensible, Descriptive Filename
  // Format: [TYPE]_[EVENT]_[TEAM_OR_IND]_[PLAYER_ROLE]_[NAME]_[CNIC_OR_AMT].[EXT]
  const cleanBase64 = payload.fileData.replace(/^data:[^;]+;base64,/, '');
  const decoded = Utilities.base64Decode(cleanBase64);

  let ext = 'jpg';
  if (payload.fileName && payload.fileName.includes('.')) {
    ext = payload.fileName.split('.').pop().toLowerCase();
  } else if (payload.mimeType && payload.mimeType.includes('/')) {
    ext = payload.mimeType.split('/').pop().toLowerCase();
  }
  if (ext === 'jpeg') ext = 'jpg';

  const cleanSanitize = (str) => (str || '').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 90);

  const prefix = cleanSanitize(payload.prefix || (isCnic ? 'CNIC' : 'PAYMENT'));
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Karachi', 'yyyyMMdd_HHmmss');
  const finalFileName = `${prefix}_${timestamp}.${ext}`;

  const blob = Utilities.newBlob(
    decoded,
    payload.mimeType || 'image/jpeg',
    finalFileName
  );

  const file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileUrl: file.getUrl(),
    fileId: file.getId(),
    fileName: finalFileName
  };
}

function syncGamesSheet() {
  const gameHeaders = ['Sr', 'Game', 'Format', 'Category', 'AgeCategory', 'EarlyFee', 'RegularFee', 'Players', 'Rules', 'Type', 'Gender', 'MinPlayers', 'MaxPlayers'];
  const gamesSheet = getOrCreateSheet(SHEET_GAMES, gameHeaders);
  gamesSheet.clear();
  gamesSheet.getRange(1, 1, 1, gameHeaders.length).setValues([gameHeaders]).setFontWeight('bold').setBackground('#A30B0B').setFontColor('#FFFFFF');
  const gamesData = getMasterGamesData();
  gamesSheet.getRange(2, 1, gamesData.length, gameHeaders.length).setValues(gamesData);
  for (let c = 1; c <= 13; c++) gamesSheet.autoResizeColumn(c);

  // Also ensure single persisted UploadFolderId without touching other Config rows
  const folders = getUploadFolders();

  return {
    success: true,
    gamesCount: gamesData.length,
    uploadFolderId: folders.rootFolder.getId(),
    message: 'Games sheet synced & upload folder locked successfully.'
  };
}

function setupSheets() {
  const ss = getSpreadsheet();
  const props = PropertiesService.getScriptProperties();

  // Preserve existing UploadFolderId if already configured
  const configSheet = getOrCreateSheet(SHEET_CONFIG, ['Key', 'Value']);
  let preservedFolderId = String(props.getProperty('UPLOAD_FOLDER_ID') || '').trim();
  try {
    const existingData = configSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]).trim() === 'UploadFolderId' && String(existingData[i][1] || '').trim()) {
        preservedFolderId = String(existingData[i][1]).trim();
        break;
      }
    }
  } catch (e) {}

  // 1. Config Sheet
  const defaults = [
    ['EventName', 'TLH SPORTS FEST 2027'],
    ['EventTagline', 'Ignite the Spirit of Sports 🔥'],
    ['BankName', 'Bank ALFALAH'],
    ['BankTitle', 'Genesis Educational Service Pvt Ltd.'],
    ['BankAccount', 'PK98ALFH0053001010451307'],
    ['EarlyBirdDeadline', '2027-01-15T23:59:59'],
    ['RegistrationDeadline', '2027-01-31T23:59:59'],
    ['RegistrationOpen', 'TRUE'],
    ['EarlyBirdOpen', 'TRUE'],
    ['UploadFolderId', preservedFolderId]
  ];
  configSheet.clear();
  configSheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold').setBackground('#A30B0B').setFontColor('#FFFFFF');
  configSheet.getRange(2, 1, defaults.length, 2).setValues(defaults);

  // 2. Games Sheet
  const gamesSheet = getOrCreateSheet(SHEET_GAMES, [
    'Sr', 'Game', 'Format', 'Category', 'AgeCategory',
    'EarlyFee', 'RegularFee', 'Players', 'Rules', 'Type', 'Gender', 'MinPlayers', 'MaxPlayers'
  ]);
  gamesSheet.clear();
  const gameHeaders = ['Sr', 'Game', 'Format', 'Category', 'AgeCategory', 'EarlyFee', 'RegularFee', 'Players', 'Rules', 'Type', 'Gender', 'MinPlayers', 'MaxPlayers'];
  gamesSheet.getRange(1, 1, 1, gameHeaders.length).setValues([gameHeaders]).setFontWeight('bold').setBackground('#A30B0B').setFontColor('#FFFFFF');
  const gamesData = getMasterGamesData();
  gamesSheet.getRange(2, 1, gamesData.length, gameHeaders.length).setValues(gamesData);

  // 3. Sheet 1: Individual_Registrations
  const indHeaders = [
    'Timestamp', 'Reg ID', 'Event / Game', 'Category', 'Format', 'Gender', 'Age Category',
    'Participant Name', 'Date of Birth', 'Phone / WhatsApp', 'Email Address', 'School / Institution',
    'CNIC / B-Form Number', 'CNIC Photo URL', 'Payment Proof URL',
    'Early Fee', 'Regular Fee', 'Fee Paid', 'Pricing Tier',
    'Verification Status', 'Email Sent'
  ];
  const indSheet = getOrCreateSheet(SHEET_INDIVIDUAL_REG, indHeaders, '#A30B0B');
  if (indSheet.getLastRow() === 0) {
    indSheet.getRange(1, 1, 1, indHeaders.length).setValues([indHeaders]).setFontWeight('bold').setBackground('#A30B0B').setFontColor('#FFFFFF');
  }

  // 4. Sheet 2: Team_Registrations
  const teamHeaders = [
    'Timestamp', 'Reg ID', 'Event / Game', 'Format', 'Category', 'Gender', 'Age Category',
    'Team Name', 'School / Institution', 'Chaperone / Coach',
    'Captain Name', 'Captain DOB / Age', 'Captain Phone', 'Captain Email',
    'Captain CNIC', 'Captain CNIC Photo URL',
    'Total Squad Count', 'Complete Squad Roster Summary',
    'Payment Proof URL', 'Early Fee', 'Regular Fee', 'Fee Paid', 'Pricing Tier',
    'Verification Status', 'Email Sent'
  ];
  const teamSheet = getOrCreateSheet(SHEET_TEAM_REG, teamHeaders, '#E8550C');
  if (teamSheet.getLastRow() === 0) {
    teamSheet.getRange(1, 1, 1, teamHeaders.length).setValues([teamHeaders]).setFontWeight('bold').setBackground('#E8550C').setFontColor('#FFFFFF');
  }

  // Auto-resize columns
  for (let c = 1; c <= 13; c++) gamesSheet.autoResizeColumn(c);
  for (let c = 1; c <= indHeaders.length; c++) indSheet.autoResizeColumn(c);
  for (let c = 1; c <= teamHeaders.length; c++) teamSheet.autoResizeColumn(c);

  Logger.log('Setup successfully completed!');
  return 'Setup completed successfully!';
}
