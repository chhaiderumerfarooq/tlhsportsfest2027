/*
 * TLH Sports Fest 3.0 - Google Sheet setup, menu, triggers and admin actions.
 */

var TLH_SHEETS = {
  Config: {
    headers: ['Key', 'Value', 'Notes'],
    widths: [230, 360, 560],
    tabColor: '#A00509'
  },
  Games: {
    headers: [
      'GameID', 'Active', 'SortOrder', 'Name', 'Category', 'Format', 'Divisions',
      'AgeGroups', 'EarlyFee', 'RegularFee', 'MinPlayers', 'MaxPlayers',
      'MaxEntries', 'Details', 'Prizes', 'Coach', 'Head', 'CoHead1', 'CoHead2'
    ],
    widths: [80, 70, 80, 250, 130, 100, 120, 140, 90, 95, 90, 90, 90, 520, 190, 120, 120, 120, 120],
    tabColor: '#C83806'
  },
  Submissions: {
    headers: [
      'SubmissionID', 'Timestamp (PKT)', 'ContactName', 'ContactRole', 'WhatsApp',
      'Email', 'Institution', 'EntryCount', 'FeeType', 'RegularTotal', 'NetTotal',
      'PaymentProof', 'TransactionID', 'PaymentStatus', 'VerifiedAt',
      'NoteToRegistrant', 'InternalNotes', 'DriveFolder', 'EmailStatus', 'Token'
    ],
    widths: [125, 155, 170, 100, 130, 220, 200, 90, 100, 110, 110, 165, 145, 120, 155, 230, 250, 180, 115, 300],
    tabColor: '#E45C06'
  },
  Entries: {
    headers: [
      'EntryID', 'SubmissionID', 'Timestamp', 'GameID', 'Game', 'Category',
      'Format', 'AgeGroup', 'Division', 'TeamName', 'Institution', 'PlayerCount',
      'FeeCharged', 'FeeType', 'Roster', 'PaymentStatus', 'Flags', 'Notes'
    ],
    widths: [140, 125, 155, 80, 210, 125, 95, 80, 80, 170, 190, 85, 100, 100, 330, 115, 330, 220],
    tabColor: '#F8AA14'
  },
  Players: {
    headers: [
      'PlayerRowID', 'EntryID', 'SubmissionID', 'Game', 'AgeGroup', 'Division',
      'No', 'Role', 'FullName', 'DOB', 'AgeOnCutoff', 'IDNumber', 'IDFile'
    ],
    widths: [130, 140, 125, 210, 80, 80, 60, 85, 190, 105, 95, 165, 160],
    tabColor: '#FFCE40'
  },
  Dashboard: {
    headers: [],
    widths: [280, 180, 140, 40, 300, 180],
    tabColor: '#5C2600'
  },
  Logs: {
    headers: ['Time', 'Level', 'Action', 'Message', 'Details'],
    widths: [155, 75, 150, 360, 560],
    tabColor: '#2D0C03'
  }
};

var TLH_CONFIG_SEED = [
  ['EventName', 'TLH Sports Fest 3.0', 'Public event name. Always write it this way.'],
  ['EventDates', 'Sat 30 and Sun 31 January 2027', 'Shown on the site and in emails.'],
  ['Venue', 'TLH Canal Campus', 'Shown on the site and in emails.'],
  ['Timezone', 'Asia/Karachi', 'Fixed. Pakistan time is UTC+5 with no daylight saving.'],
  ['RegistrationOpen', 'TRUE', 'Master switch. FALSE closes the form immediately, even before the closing date.'],
  ['EarlyBirdEndDate', '2026-12-10', 'Inclusive, valid through 23:59:59 Pakistan time. Use yyyy-mm-dd or a real date.'],
  ['RegistrationCloseDate', '2026-12-20', 'Inclusive, valid through 23:59:59 Pakistan time. Use yyyy-mm-dd or a real date.'],
  ['AgeCutoffDate', '2027-01-30', 'Ages are calculated on this date. Use yyyy-mm-dd or a real date.'],
  ['BankName', 'Bank Alfalah', 'Shown on the review step and in the confirmation email.'],
  ['AccountTitle', 'Genesis Educational Service Pvt Ltd.', 'Shown on the review step.'],
  ['IBAN', 'PK08ALFH0053001010451307', 'Shown grouped in fours on the site. Copied without spaces.'],
  ['Contact1Name', 'Javed Iqbal', 'First event head shown on the site and in emails.'],
  ['Contact1Role', 'Event Head', 'Role label for the first contact.'],
  ['Contact1Phone', '+92 301 6884762', 'Displayed phone. Call and WhatsApp links are built automatically.'],
  ['Contact2Name', 'Hadiqa Mazhar', 'Second event head shown on the site and in emails.'],
  ['Contact2Role', 'Event Head', 'Role label for the second contact.'],
  ['Contact2Phone', '+92 324 8686769', 'Displayed phone. Call and WhatsApp links are built automatically.'],
  ['SupportEmail', '', 'Optional reply-to address on emails. Leave blank to reply to the sending account.'],
  ['SocialsNotice', 'Socials tickets are sold separately. They are not included in your registration fee.', 'Shown on the landing page, review step, success screen and email.'],
  ['ConsentText', "I confirm that the details are correct, every player meets the age rule for the group entered, and I have a parent or guardian's permission for any player under 18.", 'The checkbox text on the review step.'],
  ['AnnouncementBanner', '', 'Optional. When filled, a banner appears at the top of the site.'],
  ['ReferencePrefix', 'TSF3', 'Prefix for Submission and Entry IDs. Changing it affects new IDs only.'],
  ['MaxFileMB', 5, 'Maximum size of each uploaded file, after browser compression.'],
  ['SendConfirmationEmails', 'TRUE', 'Send the registration confirmation email.'],
  ['SendStatusEmails', 'TRUE', 'Send an email when a payment is Verified or Rejected.'],
  ['TestNowOverride', '', 'TESTING ONLY: yyyy-mm-dd HH:mm in Pakistan time. The server uses this instead of the real clock. Leave blank in production. The Dashboard shows a red warning while it is set.']
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TLH Sports Fest')
    .addItem('Set up or repair workbook', 'setupWorkbook')
    .addItem('Refresh website data', 'refreshWebsiteData')
    .addItem('Resend confirmation email for selected row', 'resendConfirmationEmail')
    .addSeparator()
    .addItem('Delete test data…', 'deleteTestData')
    .addToUi();
}

/**
 * Safe to run many times. Creates or repairs tabs, headers, formats,
 * dropdowns, protection, the dashboard and triggers. Never deletes data.
 */
function setupWorkbook() {
  var ss = getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty(TLH_SPREADSHEET_ID_PROPERTY, ss.getId());

  var names = ['Config', 'Games', 'Submissions', 'Entries', 'Players', 'Dashboard', 'Logs'];
  names.forEach(function (name, index) {
    ensureSheet_(ss, name, index);
  });

  names.forEach(function (name) {
    var definition = TLH_SHEETS[name];
    var sheet = ss.getSheetByName(name);
    ensureRows_(sheet, 1000);
    if (definition.headers.length) {
      ensureColumns_(sheet, definition.headers.length);
      sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
      sheet.setFrozenRows(1);
    }
    styleSheet_(sheet, definition);
  });

  seedConfig_();
  var gamesSheet = ss.getSheetByName('Games');
  if (gamesSheet.getLastRow() < 2) {
    seedGames();
  }

  applyFormats_(ss);
  applyValidations_(ss);
  applyConditionalFormatting_(ss);
  applyProtection_(ss);
  buildDashboard_(ss);
  installTriggers_(ss);

  var submissions = ss.getSheetByName('Submissions');
  submissions.hideColumns(20);

  clearConfigCache_();
  logEvent_('INFO', 'setupWorkbook', 'Workbook set up or repaired.', { games: Math.max(0, gamesSheet.getLastRow() - 1) });

  try {
    ss.toast('Workbook ready. ' + Math.max(0, gamesSheet.getLastRow() - 1) + ' games in the Games tab.', 'TLH Sports Fest', 6);
  } catch (error) {
    // Toast is not available in every context.
  }

  return {
    ok: true,
    sheets: names,
    games: Math.max(0, gamesSheet.getLastRow() - 1)
  };
}

function ensureSheet_(ss, name, index) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, index);
  }
  if (TLH_SHEETS[name] && TLH_SHEETS[name].tabColor) {
    sheet.setTabColor(TLH_SHEETS[name].tabColor);
  }
  return sheet;
}

function ensureColumns_(sheet, count) {
  if (sheet.getMaxColumns() < count) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), count - sheet.getMaxColumns());
  }
}

function styleSheet_(sheet, definition) {
  if (definition.headers.length) {
    var header = sheet.getRange(1, 1, 1, definition.headers.length);
    header
      .setBackground('#C83806')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
    sheet.setRowHeight(1, 38);
  }
  definition.widths.forEach(function (width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
}

function seedConfig_() {
  var sheet = getSheet_('Config');
  var lastRow = sheet.getLastRow();
  var existing = {};
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      existing[String(keys[i][0] || '').trim()] = true;
    }
  }
  var missing = [];
  TLH_CONFIG_SEED.forEach(function (row) {
    if (!existing[row[0]]) missing.push(row);
  });
  if (missing.length) {
    appendRows_(sheet, missing);
    logEvent_('INFO', 'seedConfig', 'Added ' + missing.length + ' missing Config keys.');
  }
  sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), 1).setFontWeight('bold');
}

function applyFormats_(ss) {
  var submissions = ss.getSheetByName('Submissions');
  var last = submissions.getMaxRows() - 1;
  submissions.getRange(2, 2, last, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  submissions.getRange(2, 5, last, 1).setNumberFormat('@');
  submissions.getRange(2, 8, last, 1).setNumberFormat('0');
  submissions.getRange(2, 10, last, 2).setNumberFormat('#,##0');
  submissions.getRange(2, 13, last, 1).setNumberFormat('@');
  submissions.getRange(2, 15, last, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');

  var games = ss.getSheetByName('Games');
  games.getRange(2, 9, games.getMaxRows() - 1, 2).setNumberFormat('#,##0');
  games.getRange(2, 11, games.getMaxRows() - 1, 3).setNumberFormat('0');
  games.getRange(2, 1, games.getMaxRows() - 1, 19).setVerticalAlignment('top');
  games.getRange(2, 14, games.getMaxRows() - 1, 1).setWrap(true);

  var entries = ss.getSheetByName('Entries');
  entries.getRange(2, 3, entries.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  entries.getRange(2, 12, entries.getMaxRows() - 1, 1).setNumberFormat('0');
  entries.getRange(2, 13, entries.getMaxRows() - 1, 1).setNumberFormat('#,##0');
  entries.getRange(2, 15, entries.getMaxRows() - 1, 1).setWrap(true).setVerticalAlignment('top');

  var players = ss.getSheetByName('Players');
  players.getRange(2, 7, players.getMaxRows() - 1, 1).setNumberFormat('0');
  players.getRange(2, 10, players.getMaxRows() - 1, 1).setNumberFormat('@');
  players.getRange(2, 11, players.getMaxRows() - 1, 1).setNumberFormat('0');
  players.getRange(2, 12, players.getMaxRows() - 1, 1).setNumberFormat('@');

  var logs = ss.getSheetByName('Logs');
  logs.getRange(2, 1, logs.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function applyValidations_(ss) {
  var games = ss.getSheetByName('Games');
  setColumnValidation_(games, 2, ['TRUE', 'FALSE'], 'Choose TRUE to show the game, FALSE to hide it.');
  setColumnValidation_(games, 5, ['Ground Games', 'Indoor Games', 'E-Games', 'Workshops', 'Other'], 'Choose the category shown on the site.');
  setColumnValidation_(games, 6, ['Team', 'Single', 'Double', 'Individual'], 'Team, Single, Double or Individual.');

  var submissions = ss.getSheetByName('Submissions');
  setColumnValidation_(submissions, 14, ['Pending', 'Verified', 'Rejected'], 'Change this to verify or reject a payment.');

  var entries = ss.getSheetByName('Entries');
  setColumnValidation_(entries, 16, ['Pending', 'Verified', 'Rejected'], 'Kept in sync from Submissions. Edit the Submissions row instead.');

  var players = ss.getSheetByName('Players');
  setColumnValidation_(players, 8, ['Captain', 'Player', 'Extra'], 'Captain, Player or Extra.');

  var config = ss.getSheetByName('Config');
  setConfigValidation_(config, 'RegistrationOpen', ['TRUE', 'FALSE']);
  setConfigValidation_(config, 'SendConfirmationEmails', ['TRUE', 'FALSE']);
  setConfigValidation_(config, 'SendStatusEmails', ['TRUE', 'FALSE']);
}

function setColumnValidation_(sheet, column, list, helpText) {
  var range = sheet.getRange(2, column, Math.max(1, sheet.getMaxRows() - 1), 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(list, true)
    .setAllowInvalid(false)
    .setHelpText(helpText || 'Choose a value from the list.')
    .build();
  range.setDataValidation(rule);
}

function setConfigValidation_(sheet, key, list) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== key) continue;
    var cell = sheet.getRange(i + 2, 2);
    cell.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(list, true)
        .setAllowInvalid(false)
        .setHelpText('Choose ' + list.join(' or ') + '.')
        .build()
    );
    return;
  }
}

function applyConditionalFormatting_(ss) {
  var submissions = ss.getSheetByName('Submissions');
  var statusRange = submissions.getRange(2, 14, submissions.getMaxRows() - 1, 1);
  submissions.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pending').setBackground('#FFF3CD').setFontColor('#7A4A00').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Verified').setBackground('#D4EDDA').setFontColor('#155724').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Rejected').setBackground('#F8D7DA').setFontColor('#721C24').setRanges([statusRange]).build()
  ]);

  var entries = ss.getSheetByName('Entries');
  var entryStatus = entries.getRange(2, 16, entries.getMaxRows() - 1, 1);
  entries.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pending').setBackground('#FFF3CD').setFontColor('#7A4A00').setRanges([entryStatus]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Verified').setBackground('#D4EDDA').setFontColor('#155724').setRanges([entryStatus]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Rejected').setBackground('#F8D7DA').setFontColor('#721C24').setRanges([entryStatus]).build()
  ]);

  var games = ss.getSheetByName('Games');
  var activeRange = games.getRange(2, 2, games.getMaxRows() - 1, 1);
  games.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('FALSE').setBackground('#E8E8E8').setFontColor('#777777').setRanges([activeRange]).build()
  ]);

  var dashboard = ss.getSheetByName('Dashboard');
  dashboard.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=ISNUMBER(SEARCH("TEST MODE",$A$2))')
      .setBackground('#A00509')
      .setFontColor('#FFFFFF')
      .setBold(true)
      .setRanges([dashboard.getRange('A2:F2')])
      .build()
  ]);
}

function applyProtection_(ss) {
  var submissions = ss.getSheetByName('Submissions');
  protectColumns_(submissions, [
    { column: 1, count: 2, label: 'Submission ID and timestamp' },
    { column: 8, count: 5, label: 'Counts, fee type and totals' },
    { column: 18, count: 3, label: 'Drive folder, email status and token' }
  ]);

  var entries = ss.getSheetByName('Entries');
  protectColumns_(entries, [{ column: 1, count: 16, label: 'Script-written entry columns' }]);

  var players = ss.getSheetByName('Players');
  protectColumns_(players, [{ column: 1, count: 13, label: 'Script-written player columns' }]);
}

function protectColumns_(sheet, groups) {
  var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  existing.forEach(function (protection) {
    var description = protection.getDescription() || '';
    if (description.indexOf('TLH auto:') === 0) protection.remove();
  });
  groups.forEach(function (group) {
    var range = sheet.getRange(2, group.column, Math.max(1, sheet.getMaxRows() - 1), group.count);
    range.protect()
      .setDescription('TLH auto: ' + group.label)
      .setWarningOnly(true);
  });
}

function buildDashboard_(ss) {
  var sheet = ss.getSheetByName('Dashboard');
  sheet.clearContents();
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 6, 190);
  sheet.setColumnWidth(1, 300);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(5, 320);

  sheet.getRange('A1').setValue('TLH Sports Fest 3.0 — Dashboard').setFontSize(18).setFontWeight('bold').setFontColor('#A00509');
  sheet.getRange('A2').setFormula(
    '=IF(IFERROR(VLOOKUP("TestNowOverride",Config!$A:$B,2,FALSE),"")="","",' +
    '"TEST MODE: server time is overridden to "&IFERROR(VLOOKUP("TestNowOverride",Config!$A:$B,2,FALSE),"")&". Clear TestNowOverride in Config to return to real time.")'
  );

  sheet.getRange('A4').setValue('Payments by status').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A5:C5').setValues([['Status', 'Submissions', 'Amount']]).setFontWeight('bold').setBackground('#FFE0C2');
  sheet.getRange('A6:C9').setValues([
    ['Pending', null, null],
    ['Verified', null, null],
    ['Rejected', null, null],
    ['Total', null, null]
  ]);
  sheet.getRange('B6').setFormula('=COUNTIF(Submissions!$N$2:$N,"Pending")');
  sheet.getRange('C6').setFormula('=SUMIF(Submissions!$N$2:$N,"Pending",Submissions!$K$2:$K)');
  sheet.getRange('B7').setFormula('=COUNTIF(Submissions!$N$2:$N,"Verified")');
  sheet.getRange('C7').setFormula('=SUMIF(Submissions!$N$2:$N,"Verified",Submissions!$K$2:$K)');
  sheet.getRange('B8').setFormula('=COUNTIF(Submissions!$N$2:$N,"Rejected")');
  sheet.getRange('C8').setFormula('=SUMIF(Submissions!$N$2:$N,"Rejected",Submissions!$K$2:$K)');
  sheet.getRange('B9').setFormula('=COUNTA(Submissions!$A$2:$A)');
  sheet.getRange('C9').setFormula('=SUM(Submissions!$K$2:$K)');
  sheet.getRange('C6:C9').setNumberFormat('"Rs "#,##0');

  sheet.getRange('E4').setValue('Key numbers').setFontWeight('bold').setFontSize(12);
  sheet.getRange('E5:F5').setValues([['Measure', 'Value']]).setFontWeight('bold').setBackground('#FFE0C2');
  sheet.getRange('E6:F11').setValues([
    ['Expected revenue (not rejected)', null],
    ['Verified revenue', null],
    ['Early bird submissions', null],
    ['Regular submissions', null],
    ['Total entries', null],
    ['Total players', null]
  ]);
  sheet.getRange('F6').setFormula('=SUMIF(Submissions!$N$2:$N,"<>Rejected",Submissions!$K$2:$K)');
  sheet.getRange('F7').setFormula('=SUMIF(Submissions!$N$2:$N,"Verified",Submissions!$K$2:$K)');
  sheet.getRange('F8').setFormula('=COUNTIF(Submissions!$I$2:$I,"Early Bird")');
  sheet.getRange('F9').setFormula('=COUNTIF(Submissions!$I$2:$I,"Regular")');
  sheet.getRange('F10').setFormula('=COUNTA(Entries!$A$2:$A)');
  sheet.getRange('F11').setFormula('=COUNTA(Players!$I$2:$I)');
  sheet.getRange('F6:F7').setNumberFormat('"Rs "#,##0');

  sheet.getRange('A13').setValue('Entries per game and age group').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A14').setFormula(
    '=IFERROR(QUERY(Entries!$A$2:$R,"select D, E, H, count(A) where D is not null group by D, E, H label D \'Game ID\', E \'Game\', H \'Age group\', count(A) \'Entries\'",0),"No entries yet")'
  );
  sheet.getRange('A14:D14').setFontWeight('bold').setBackground('#FFE0C2');
}

function installTriggers_(ss) {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'onEditInstallable' || handler === 'cleanupPendingUploads') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('cleanupPendingUploads').timeBased().atHour(3).everyDays(1).create();
}

/* ------------------------------------------------------------------ *
 * Menu actions
 * ------------------------------------------------------------------ */

function refreshWebsiteData() {
  clearConfigCache_();
  logEvent_('INFO', 'refreshWebsiteData', 'Website data cache cleared from the menu.');
  try {
    SpreadsheetApp.getActive().toast('Website data will refresh within a minute.', 'TLH Sports Fest', 5);
  } catch (error) {
    // No UI in some contexts.
  }
}

function resendConfirmationEmail() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== 'Submissions') {
    ui.alert('Open the Submissions tab and select a row first.');
    return;
  }
  var row = sheet.getActiveRange().getRow();
  if (row < 2) {
    ui.alert('Select a submission row (not the header).');
    return;
  }
  var submissionId = String(sheet.getRange(row, 1).getValue() || '');
  if (!submissionId) {
    ui.alert('That row has no Submission ID.');
    return;
  }
  var data = buildEmailDataFromSheet_(submissionId);
  if (!data) {
    ui.alert('Could not read submission ' + submissionId + '.');
    return;
  }
  try {
    var result = sendConfirmationEmail_(data);
    sheet.getRange(row, 19).setValue(result.sent ? 'SENT' : 'FAILED');
    ui.alert(result.sent ? 'Confirmation email sent for ' + submissionId + '.' : 'Email failed: ' + result.error);
  } catch (error) {
    logEvent_('ERROR', 'resendConfirmationEmail', 'Email failed for ' + submissionId, String(error.message || error));
    ui.alert('Email failed: ' + (error.message || error));
  }
}

function deleteTestData() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Delete test data',
    'This removes Submissions, Entries and Players rows whose ContactName starts with TEST, plus their Drive folders. Type DELETE to continue.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  if (String(response.getResponseText() || '').trim().toUpperCase() !== 'DELETE') {
    ui.alert('Nothing was deleted. Type DELETE exactly to confirm.');
    return;
  }

  var ss = getSpreadsheet_();
  var submissions = ss.getSheetByName('Submissions');
  var entries = ss.getSheetByName('Entries');
  var players = ss.getSheetByName('Players');
  var removed = [];
  var row = submissions.getLastRow();

  while (row >= 2) {
    var values = submissions.getRange(row, 1, 1, 20).getValues()[0];
    var contactName = String(values[2] || '').trim();
    if (/^TEST/i.test(contactName)) {
      var submissionId = String(values[0] || '');
      var folderName = folderSafeName_(submissionId + ' - ' + contactName);
      if (submissionId) {
        removed.push(submissionId);
        deleteRowsBySubmission_(entries, submissionId, 2);
        deleteRowsBySubmission_(players, submissionId, 3);
        trashSubmissionFolders_(submissionId, folderName);
      }
      submissions.deleteRow(row);
    }
    row--;
  }

  clearConfigCache_();
  logEvent_('INFO', 'deleteTestData', 'Deleted ' + removed.length + ' TEST submissions.', removed.join(', '));
  ui.alert('Deleted ' + removed.length + ' test submission' + (removed.length === 1 ? '' : 's') + '.');
}

function deleteRowsBySubmission_(sheet, submissionId, column) {
  for (var row = sheet.getLastRow(); row >= 2; row--) {
    if (String(sheet.getRange(row, column).getValue() || '') === submissionId) {
      sheet.deleteRow(row);
    }
  }
}

function trashSubmissionFolders_(submissionId, folderName) {
  ['payment', 'id'].forEach(function (kind) {
    try {
      var root = getDriveRoot_(kind);
      var folders = root.getFolders();
      while (folders.hasNext()) {
        var folder = folders.next();
        var name = folder.getName();
        if (name === folderName || name.indexOf(submissionId + ' - ') === 0) {
          folder.setTrashed(true);
        }
      }
    } catch (error) {
      logEvent_('ERROR', 'trashSubmissionFolders', 'Could not trash a folder for ' + submissionId, String(error.message || error));
    }
  });
}

/* ------------------------------------------------------------------ *
 * Installable triggers
 * ------------------------------------------------------------------ */

function onEditInstallable(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name = sheet.getName();

  if (name === 'Config' || name === 'Games') {
    clearConfigCache_();
  }

  if (name !== 'Submissions') return;
  if (e.range.getColumn() !== 14) return;

  var rows = e.range.getNumRows();
  for (var i = 0; i < rows; i++) {
    var row = e.range.getRow() + i;
    if (row < 2) continue;
    var submissionId = String(sheet.getRange(row, 1).getValue() || '');
    if (!submissionId) continue;
    var status = String(sheet.getRange(row, 14).getValue() || '').trim();
    var oldValue = rows === 1 ? String(e.oldValue || '').trim() : '';

    if (status === 'Verified') {
      sheet.getRange(row, 15).setValue(new Date());
    } else if (status === 'Pending' || status === 'Rejected') {
      sheet.getRange(row, 15).clearContent();
    }

    syncEntryStatus_(submissionId, status);
    clearConfigCache_();

    if (status !== oldValue && (status === 'Verified' || status === 'Rejected')) {
      sendStatusEmailForRow_(row, submissionId, status);
    }
  }
}

function syncEntryStatus_(submissionId, status) {
  var entries = getSheet_('Entries');
  var lastRow = entries.getLastRow();
  if (lastRow < 2) return;
  var values = entries.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === submissionId) {
      entries.getRange(i + 2, 16).setValue(status);
    }
  }
}

function sendStatusEmailForRow_(row, submissionId, status) {
  var map = readConfigMap_();
  if (!configBool_(map, 'SendStatusEmails', true)) return;
  var note = String(getSheet_('Submissions').getRange(row, 16).getValue() || '');
  var data = buildEmailDataFromSheet_(submissionId);
  if (!data) return;
  try {
    sendStatusEmail_(data, status, note);
    logEvent_('INFO', 'statusEmail', 'Sent ' + status + ' email for ' + submissionId);
  } catch (error) {
    logEvent_('ERROR', 'statusEmail', 'Email failed for ' + submissionId, String(error.message || error));
  }
}

function cleanupPendingUploads() {
  var cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  var removed = 0;
  ['payment', 'id'].forEach(function (kind) {
    try {
      var root = getDriveRoot_(kind);
      var pending = findSubfolder_(root, 'pending');
      if (!pending) return;

      var folders = pending.getFolders();
      var oldFolders = [];
      while (folders.hasNext()) {
        var folder = folders.next();
        if (folder.getDateCreated() < cutoff) oldFolders.push(folder);
      }
      oldFolders.forEach(function (folder) {
        folder.setTrashed(true);
        removed++;
      });

      var files = pending.getFiles();
      var oldFiles = [];
      while (files.hasNext()) {
        var file = files.next();
        if (file.getDateCreated() < cutoff) oldFiles.push(file);
      }
      oldFiles.forEach(function (file) {
        file.setTrashed(true);
        removed++;
      });
    } catch (error) {
      logEvent_('ERROR', 'cleanupPendingUploads', 'Cleanup failed for ' + kind, String(error.message || error));
    }
  });
  if (removed) logEvent_('INFO', 'cleanupPendingUploads', 'Removed ' + removed + ' expired pending upload items.');
}
