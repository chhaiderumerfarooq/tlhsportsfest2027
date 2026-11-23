/*
 * TLH Sports Fest 3.0 - Google Sheet setup, menu, triggers and admin actions.
 *
 * The visible registration data lives in two flat tabs, one row per entry:
 * Team Games and Solo Games. Config and Games remain editable settings tabs.
 */

var TLH_SHEETS = {
  Dashboard: {
    headers: [],
    widths: [280, 180, 140, 40, 300, 180],
    tabColor: '#5C2600'
  },
  'Team Games': {
    headers: [],
    widths: [],
    tabColor: '#C83806'
  },
  'Solo Games': {
    headers: [],
    widths: [],
    tabColor: '#F8AA14'
  },
  Games: {
    headers: [
      'GameID', 'Active', 'SortOrder', 'Name', 'Category', 'Format', 'Divisions',
      'AgeGroups', 'EarlyFee', 'RegularFee', 'MinPlayers', 'MaxPlayers',
      'MaxEntries', 'Details', 'Prizes', 'Coach', 'Head', 'CoHead1', 'CoHead2'
    ],
    widths: [80, 70, 80, 250, 130, 100, 120, 140, 90, 95, 90, 90, 90, 520, 190, 120, 120, 120, 120],
    tabColor: '#E45C06'
  },
  Config: {
    headers: ['Key', 'Value', 'Notes'],
    widths: [230, 360, 560],
    tabColor: '#A00509'
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
  ['BankName', 'Bank Alfalah', 'Shown on the payment section and in the confirmation email.'],
  ['AccountTitle', 'Genesis Educational Service Pvt Ltd.', 'Shown on the payment section.'],
  ['IBAN', 'PK08ALFH0053001010451307', 'Shown grouped in fours on the site. Copied without spaces.'],
  ['Contact1Name', 'Javed Iqbal', 'First event head shown on the site and in emails.'],
  ['Contact1Role', 'Event Head', 'Role label for the first contact.'],
  ['Contact1Phone', '+92 301 6884762', 'Displayed phone. Call and WhatsApp links are built automatically.'],
  ['Contact2Name', 'Hadiqa Mazhar', 'Second event head shown on the site and in emails.'],
  ['Contact2Role', 'Event Head', 'Role label for the second contact.'],
  ['Contact2Phone', '+92 324 8686769', 'Displayed phone. Call and WhatsApp links are built automatically.'],
  ['SupportEmail', '', 'Optional reply-to address on emails. Leave blank to reply to the sending account.'],
  ['SocialsNotice', 'Socials tickets are sold separately. They are not included in your registration fee.', 'Shown on the event page, payment section, success screen and email.'],
  ['ConsentText', "I confirm that the details are correct, every player meets the age rule for the group entered, and I have a parent or guardian's permission for any player under 18.", 'The checkbox text on the form.'],
  ['AnnouncementBanner', '', 'Optional. When filled, a banner appears at the top of the site.'],
  ['ReferencePrefix', 'TSF3', 'Prefix for Registration and Entry IDs. Changing it affects new IDs only.'],
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
    .addItem('Set payment status for selected rows…', 'setPaymentStatusForSelection')
    .addItem('Set age check for selected rows…', 'setAgeCheckForSelection')
    .addSeparator()
    .addItem('Delete test data…', 'deleteTestData')
    .addToUi();
}

function getOrCreateWorkbook_() {
  try {
    var existing = SpreadsheetApp.getActiveSpreadsheet();
    if (existing) return existing;
  } catch (error) {
    // No active spreadsheet; continue and open by stored ID or create one.
  }
  try {
    var storedId = PropertiesService.getScriptProperties().getProperty(TLH_SPREADSHEET_ID_PROPERTY);
    if (storedId) return SpreadsheetApp.openById(storedId);
  } catch (error) {
    // Ignore and create below.
  }
  var sheet = SpreadsheetApp.create('TLH Sports Fest 3.0');
  PropertiesService.getScriptProperties().setProperty(TLH_SPREADSHEET_ID_PROPERTY, sheet.getId());
  return sheet;
}

/**
 * Safe to run many times. Creates or repairs tabs, headers, formats,
 * dropdowns, protection, the dashboard and triggers. Never deletes real data.
 */
function setupWorkbook() {
  var ss = getOrCreateWorkbook_();
  PropertiesService.getScriptProperties().setProperty(TLH_SPREADSHEET_ID_PROPERTY, ss.getId());

  var names = ['Dashboard', 'Team Games', 'Solo Games', 'Games', 'Config', 'Logs'];
  names.forEach(function (name, index) {
    ensureSheet_(ss, name, index);
  });

  // Flat tabs have a variable number of player columns.
  flatSheetDefs_().forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    ensureRows_(sheet, 1000);
    var headers = flatHeadersForDef_(def);
    ensureColumns_(sheet, headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3);
    styleSheet_(sheet, {
      headers: headers,
      widths: flatWidthsForDef_(def),
      tabColor: def.tabColor
    });
    sheet.hideColumns(TLH_FLAT_COL.token + 1);
  });

  removeDefaultSheet_(ss);

  ['Games', 'Config', 'Logs'].forEach(function (name) {
    var definition = TLH_SHEETS[name];
    var sheet = ss.getSheetByName(name);
    ensureRows_(sheet, name === 'Config' ? 100 : 1000);
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
  repairSeedActiveFlagsOnce_();
  migrateLegacySheets_(ss);

  applyFormats_(ss);
  applyValidations_(ss);
  applyConditionalFormatting_(ss);
  applyProtection_(ss);
  buildDashboard_(ss);
  installTriggers_(ss);

  clearConfigCache_();
  logEvent_('INFO', 'setupWorkbook', 'Workbook set up or repaired.', {
    games: Math.max(0, gamesSheet.getLastRow() - 1),
    teamRows: Math.max(0, ss.getSheetByName('Team Games').getLastRow() - 1),
    soloRows: Math.max(0, ss.getSheetByName('Solo Games').getLastRow() - 1)
  });

  try {
    ss.toast('Workbook ready. Registrations are saved in Team Games and Solo Games.', 'TLH Sports Fest', 6);
  } catch (error) {
    // Toast is not available in every context.
  }

  return {
    ok: true,
    sheets: names,
    games: Math.max(0, gamesSheet.getLastRow() - 1)
  };
}

/**
 * One-time repair for workbooks seeded by the first version of the seed
 * generator, which wrote the string "FALSE" into the Active column. The
 * string was truthy when the Games tab was built, so inactive games were
 * inserted as active. Runs once, then records a Script Property.
 */
function repairSeedActiveFlagsOnce_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('TLH_SEED_ACTIVE_REPAIR_V1') === 'done') return;

  var ss;
  try {
    ss = getSpreadsheet_();
  } catch (error) {
    return;
  }
  var sheet = ss.getSheetByName('Games');
  if (!sheet || sheet.getLastRow() < 2) return;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var byId = {};
  TLH_SEED_GAMES.forEach(function (game) {
    byId[String(game.gameId)] = game;
  });

  var changed = 0;
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    var seed = byId[id];
    if (!seed) continue;
    var seedActive = parseBool_(seed.active, false);
    var sheetActive = parseBool_(values[i][1], false);
    if (!seedActive && sheetActive) {
      sheet.getRange(i + 2, 2).setValue('FALSE');
      changed++;
    }
  }

  props.setProperty('TLH_SEED_ACTIVE_REPAIR_V1', 'done');
  if (changed) {
    logEvent_('INFO', 'repairSeedActiveFlags', 'Set ' + changed + ' seed game(s) to inactive.');
  }
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

/** A brand-new spreadsheet starts with an empty Sheet1. Remove it once the real tabs exist. */
function removeDefaultSheet_(ss) {
  var sheet = ss.getSheetByName('Sheet1');
  if (!sheet) return;
  if (ss.getSheets().length <= 1) return;
  if (sheet.getLastRow() > 0 || sheet.getLastColumn() > 0) return;
  try {
    ss.deleteSheet(sheet);
  } catch (error) {
    // Leaving an empty tab behind is harmless.
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
  flatSheetDefs_().forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    var rows = Math.max(1, sheet.getMaxRows() - 1);
    sheet.getRange(2, TLH_FLAT_COL.timestamp + 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(2, TLH_FLAT_COL.fee + 1, rows, 2).setNumberFormat('#,##0');
    sheet.getRange(2, TLH_FLAT_COL.verifiedAt + 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(2, TLH_FLAT_COL.contactName + 1, rows, 6).setNumberFormat('@');
    sheet.getRange(2, TLH_FLAT_COL.transactionId + 1, rows, 1).setNumberFormat('@');
    sheet.getRange(2, TLH_FLAT_COL.token + 1, rows, 1).setNumberFormat('@');
    for (var p = 0; p < def.maxPlayers; p++) {
      var offset = TLH_FLAT_COL.playerStart + (p * 4);
      sheet.getRange(2, offset + 2, rows, 1).setNumberFormat('yyyy-mm-dd');
      sheet.getRange(2, offset + 3, rows, 1).setNumberFormat('@');
      sheet.getRange(2, offset + 4, rows, 1).setNumberFormat('0');
    }
    sheet.getRange(2, 1, rows, flatRowWidth_(def)).setVerticalAlignment('top');
  });

  var games = ss.getSheetByName('Games');
  games.getRange(2, 9, games.getMaxRows() - 1, 2).setNumberFormat('#,##0');
  games.getRange(2, 11, games.getMaxRows() - 1, 3).setNumberFormat('0');
  games.getRange(2, 1, games.getMaxRows() - 1, 19).setVerticalAlignment('top');
  games.getRange(2, 14, games.getMaxRows() - 1, 1).setWrap(true);

  var logs = ss.getSheetByName('Logs');
  logs.getRange(2, 1, logs.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function applyValidations_(ss) {
  var games = ss.getSheetByName('Games');
  setColumnValidation_(games, 2, ['TRUE', 'FALSE'], 'Choose TRUE to show the game, FALSE to hide it.');
  setColumnValidation_(games, 5, ['Ground Games', 'Indoor Games', 'E-Games', 'Workshops', 'Other'], 'Choose the category shown on the site.');
  setColumnValidation_(games, 6, ['Team', 'Single', 'Double', 'Individual'], 'Team, Single, Double or Individual.');

  flatSheetDefs_().forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    setColumnValidation_(sheet, TLH_FLAT_COL.paymentStatus + 1, ['Pending', 'Verified', 'Rejected'], 'Change this to verify or reject a payment.');
    setColumnValidation_(sheet, TLH_FLAT_COL.ageCheck + 1, ['OK', 'Review'], 'OK, or Review if the age or ID needs a second look.');
  });

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
  flatSheetDefs_().forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    var statusRange = sheet.getRange(2, TLH_FLAT_COL.paymentStatus + 1, sheet.getMaxRows() - 1, 1);
    var ageRange = sheet.getRange(2, TLH_FLAT_COL.ageCheck + 1, sheet.getMaxRows() - 1, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Pending').setBackground('#FFF3CD').setFontColor('#7A4A00').setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Verified').setBackground('#D4EDDA').setFontColor('#155724').setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Rejected').setBackground('#F8D7DA').setFontColor('#721C24').setRanges([statusRange]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Review').setBackground('#FDE2E4').setFontColor('#A00509').setBold(true).setRanges([ageRange]).build()
    ]);
  });

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
  flatSheetDefs_().forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    var playerColumns = def.maxPlayers * 4;
    protectColumns_(sheet, [
      { column: 1, count: TLH_FLAT_COL.playerCount + 1, label: 'Script-written registration columns' },
      { column: TLH_FLAT_COL.paymentProof + 1, count: 2, label: 'Payment proof and verified time' },
      { column: TLH_FLAT_COL.flags + 1, count: 1, label: 'Duplicate and age flags' },
      { column: TLH_FLAT_COL.registrationFolder + 1, count: 4, label: 'Folder links, email status and token' },
      { column: TLH_FLAT_COL.playerStart + 1, count: playerColumns, label: 'Player columns' }
    ]);
  });
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
  sheet.clearConditionalFormatRules();
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
  sheet.getRange('A3').setValue('Team Games and Solo Games each contain one row per entry. Edit PaymentStatus or AgeCheck directly; the menu can do it for selected rows.').setFontColor('#5C2600');

  sheet.getRange('A5').setValue('Payments by status').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A6:C6').setValues([['Status', 'Entries', 'Amount']]).setFontWeight('bold').setBackground('#FFE0C2');
  sheet.getRange('A7:C10').setValues([
    ['Pending', null, null],
    ['Verified', null, null],
    ['Rejected', null, null],
    ['Total', null, null]
  ]);
  ['Pending', 'Verified', 'Rejected'].forEach(function (status, index) {
    var row = 7 + index;
    sheet.getRange(row, 2).setFormula(
      '=COUNTIF(\'Team Games\'!$T$2:$T,"' + status + '")+COUNTIF(\'Solo Games\'!$T$2:$T,"' + status + '")'
    );
    sheet.getRange(row, 3).setFormula(
      '=SUMIF(\'Team Games\'!$T$2:$T,"' + status + '",\'Team Games\'!$Q$2:$Q)+' +
      'SUMIF(\'Solo Games\'!$T$2:$T,"' + status + '",\'Solo Games\'!$Q$2:$Q)'
    );
  });
  sheet.getRange('B10').setFormula('=COUNTA(\'Team Games\'!$A$2:$A)+COUNTA(\'Solo Games\'!$A$2:$A)');
  sheet.getRange('C10').setFormula('=SUM(\'Team Games\'!$Q$2:$Q)+SUM(\'Solo Games\'!$Q$2:$Q)');
  sheet.getRange('C7:C10').setNumberFormat('"Rs "#,##0');

  sheet.getRange('E5').setValue('Key numbers').setFontWeight('bold').setFontSize(12);
  sheet.getRange('E6:F6').setValues([['Measure', 'Value']]).setFontWeight('bold').setBackground('#FFE0C2');
  sheet.getRange('E7:F12').setValues([
    ['Expected revenue (not rejected)', null],
    ['Verified revenue', null],
    ['Early bird entries', null],
    ['Regular entries', null],
    ['Total entries', null],
    ['Total players', null]
  ]);
  sheet.getRange('F7').setFormula(
    '=SUMIF(\'Team Games\'!$T$2:$T,"<>Rejected",\'Team Games\'!$Q$2:$Q)+' +
    'SUMIF(\'Solo Games\'!$T$2:$T,"<>Rejected",\'Solo Games\'!$Q$2:$Q)'
  );
  sheet.getRange('F8').setFormula(
    '=SUMIF(\'Team Games\'!$T$2:$T,"Verified",\'Team Games\'!$Q$2:$Q)+' +
    'SUMIF(\'Solo Games\'!$T$2:$T,"Verified",\'Solo Games\'!$Q$2:$Q)'
  );
  sheet.getRange('F9').setFormula('=COUNTIF(\'Team Games\'!$S$2:$S,"Early Bird")+COUNTIF(\'Solo Games\'!$S$2:$S,"Early Bird")');
  sheet.getRange('F10').setFormula('=COUNTIF(\'Team Games\'!$S$2:$S,"Regular")+COUNTIF(\'Solo Games\'!$S$2:$S,"Regular")');
  sheet.getRange('F11').setFormula('=COUNTA(\'Team Games\'!$A$2:$A)+COUNTA(\'Solo Games\'!$A$2:$A)');
  sheet.getRange('F12').setFormula('=SUM(\'Team Games\'!$P$2:$P)+SUM(\'Solo Games\'!$P$2:$P)');
  sheet.getRange('F7:F8').setNumberFormat('"Rs "#,##0');

  sheet.getRange('A14').setValue('Entries per game and age group').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A15').setFormula(
    '=IFERROR(QUERY({\'Team Games\'!$A$2:$AE$1000;\'Solo Games\'!$A$2:$AE$1000},' +
    '"select Col9, Col10, Col13, count(Col1) where Col9 is not null group by Col9, Col10, Col13 ' +
    'label Col9 \'Game ID\', Col10 \'Game\', Col13 \'Age group\', count(Col1) \'Entries\'",0),"No entries yet")'
  );
  sheet.getRange('A15:D15').setFontWeight('bold').setBackground('#FFE0C2');
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
 * Migration from the old Submissions / Entries / Players schema
 * ------------------------------------------------------------------ */

function migrateLegacySheets_(ss) {
  var legacyNames = ['Submissions', 'Entries', 'Players'];
  var sheets = legacyNames.map(function (name) { return ss.getSheetByName(name); })
    .filter(function (sheet) { return sheet; });
  if (!sheets.length) return;

  var hasData = sheets.some(function (sheet) { return sheet.getLastRow() >= 2; });
  if (!hasData) {
    sheets.forEach(function (sheet) { ss.deleteSheet(sheet); });
    logEvent_('INFO', 'migrateLegacySheets', 'Removed empty legacy tabs.');
    return;
  }

  var flatHasData = flatSheetDefs_().some(function (def) {
    var sheet = ss.getSheetByName(def.name);
    return sheet && sheet.getLastRow() >= 2;
  });
  if (flatHasData) {
    archiveLegacySheets_(ss, sheets);
    return;
  }

  try {
    var submissionsSheet = ss.getSheetByName('Submissions');
    var entriesSheet = ss.getSheetByName('Entries');
    var playersSheet = ss.getSheetByName('Players');
    var submissions = {};
    var entries = [];
    var playersByEntry = {};
    var gamesById = {};
    getGames_().forEach(function (game) { gamesById[game.id] = game; });
    var cutoff = configText_(readConfigMap_(), 'AgeCutoffDate', '');

    if (submissionsSheet && submissionsSheet.getLastRow() >= 2) {
      submissionsSheet.getRange(2, 1, submissionsSheet.getLastRow() - 1, 20).getValues().forEach(function (row) {
        submissions[String(row[0] || '')] = row;
      });
    }
    if (entriesSheet && entriesSheet.getLastRow() >= 2) {
      entries = entriesSheet.getRange(2, 1, entriesSheet.getLastRow() - 1, 18).getValues();
    }
    if (playersSheet && playersSheet.getLastRow() >= 2) {
      playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 13).getValues().forEach(function (row) {
        var entryId = String(row[1] || '');
        if (!playersByEntry[entryId]) playersByEntry[entryId] = [];
        playersByEntry[entryId].push({
          name: String(row[8] || ''),
          dob: parseDateOnly(row[9]),
          idNumber: String(row[11] || ''),
          age: row[10] === '' ? null : Number(row[10])
        });
      });
    }

    var items = [];
    entries.forEach(function (entry) {
      var submissionId = String(entry[1] || '');
      var sub = submissions[submissionId];
      if (!sub) return;
      var entryId = String(entry[0] || '');
      var game = gamesById[String(entry[3] || '')];
      var players = playersByEntry[entryId] || [];
      var ageCheck = 'OK';
      if (game && String(entry[7] || '') !== 'Open') {
        players.forEach(function (player) {
          if (!isDobEligible(player.dob, String(entry[7] || ''), cutoff)) ageCheck = 'Review';
        });
      }
      var built = buildFlatRow_({
        registrationId: submissionId,
        entryId: entryId,
        timestamp: sub[1] || entry[2],
        contact: {
          name: String(sub[2] || ''),
          role: String(sub[3] || ''),
          whatsapp: String(sub[4] || ''),
          email: String(sub[5] || ''),
          institution: String(sub[6] || '')
        },
        gameId: String(entry[3] || ''),
        game: String(entry[4] || ''),
        category: String(entry[5] || ''),
        format: String(entry[6] || ''),
        ageGroup: String(entry[7] || ''),
        division: String(entry[8] || ''),
        teamName: String(entry[9] || ''),
        players: players,
        fee: Number(entry[12]) || 0,
        regularFee: game ? regularFeeFor(game) : (Number(entry[12]) || 0),
        feeType: String(entry[13] || sub[8] || ''),
        paymentStatus: String(sub[13] || entry[15] || 'Pending'),
        transactionId: String(sub[12] || ''),
        paymentProof: sub[11] || '',
        verifiedAt: sub[14] || '',
        ageCheck: ageCheck,
        flags: String(entry[16] || ''),
        note: String(sub[15] || ''),
        adminNotes: String(entry[17] || sub[16] || ''),
        registrationFolder: sub[17] || '',
        idFolder: '',
        emailStatus: String(sub[18] || 'PENDING'),
        token: String(sub[19] || ''),
        ageCutoffDate: cutoff
      });
      items.push(built);
    });

    if (!items.length) {
      archiveLegacySheets_(ss, sheets);
      logEvent_('WARN', 'migrateLegacySheets', 'Legacy tabs had data but no entry rows could be migrated.');
      return;
    }

    appendFlatRows_(items);
    archiveLegacySheets_(ss, sheets);
    logEvent_('INFO', 'migrateLegacySheets', 'Migrated ' + items.length + ' entries into Team Games / Solo Games.');
  } catch (error) {
    logEvent_('ERROR', 'migrateLegacySheets', 'Migration failed; legacy tabs were kept.', String(error.message || error));
  }
}

function archiveLegacySheets_(ss, sheets) {
  sheets.forEach(function (sheet) {
    var newName = 'Archive - ' + sheet.getName();
    try {
      sheet.setName(newName);
    } catch (error) {
      // A tab with that name may already exist.
      newName = 'Archive - ' + sheet.getName() + ' ' + Date.now();
      sheet.setName(newName);
    }
    sheet.hideSheet();
  });
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

function setPaymentStatusForSelection() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!isFlatSheetName_(sheet.getName())) {
    ui.alert('Open the Team Games or Solo Games tab and select one or more rows first.');
    return;
  }
  var range = sheet.getActiveRange();
  if (!range || range.getRow() < 2) {
    ui.alert('Select one or more registration rows (not the header).');
    return;
  }
  var response = ui.prompt(
    'Set payment status',
    'Type Verified, Rejected or Pending for the selected rows.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var status = String(response.getResponseText() || '').trim();
  var match = ['Pending', 'Verified', 'Rejected'].filter(function (item) {
    return item.toLowerCase() === status.toLowerCase();
  })[0];
  if (!match) {
    ui.alert('Type Verified, Rejected or Pending exactly.');
    return;
  }
  var regIds = {};
  for (var row = range.getRow(); row < range.getRow() + range.getNumRows(); row++) {
    var regId = String(sheet.getRange(row, 1).getValue() || '').trim();
    if (regId) regIds[regId] = true;
  }
  var results = [];
  Object.keys(regIds).forEach(function (regId) {
    results.push(applyPaymentStatusToRegistration_(regId, match, '', { sendEmail: true }));
  });
  ui.alert('Updated ' + results.length + ' registration' + (results.length === 1 ? '' : 's') + ' to ' + match + '.');
}

function setAgeCheckForSelection() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!isFlatSheetName_(sheet.getName())) {
    ui.alert('Open the Team Games or Solo Games tab and select one or more rows first.');
    return;
  }
  var range = sheet.getActiveRange();
  if (!range || range.getRow() < 2) {
    ui.alert('Select one or more registration rows (not the header).');
    return;
  }
  var response = ui.prompt(
    'Set age check',
    'Type OK or Review for the selected rows.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var value = String(response.getResponseText() || '').trim();
  var match = ['OK', 'Review'].filter(function (item) { return item.toLowerCase() === value.toLowerCase(); })[0];
  if (!match) {
    ui.alert('Type OK or Review.');
    return;
  }
  var rows = [];
  for (var row = range.getRow(); row < range.getRow() + range.getNumRows(); row++) rows.push(row);
  var result = applyAgeCheckToRows_(sheet, rows, match);
  ui.alert(result.ok ? 'Updated ' + result.changed + ' row(s) to ' + match + '.' : result.message);
}

function resendConfirmationEmail() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  if (!isFlatSheetName_(sheet.getName())) {
    ui.alert('Open the Team Games or Solo Games tab and select a registration row first.');
    return;
  }
  var row = sheet.getActiveRange().getRow();
  if (row < 2) {
    ui.alert('Select a registration row (not the header).');
    return;
  }
  var registrationId = String(sheet.getRange(row, 1).getValue() || '');
  if (!registrationId) {
    ui.alert('That row has no Registration ID.');
    return;
  }
  var data = buildEmailDataFromSheet_(registrationId);
  if (!data) {
    ui.alert('Could not read registration ' + registrationId + '.');
    return;
  }
  try {
    var result = sendConfirmationEmail_(data);
    setFlatEmailStatus_(registrationId, result.sent ? 'SENT' : 'FAILED');
    ui.alert(result.sent ? 'Confirmation email sent for ' + registrationId + '.' : 'Email failed: ' + result.error);
  } catch (error) {
    logEvent_('ERROR', 'resendConfirmationEmail', 'Email failed for ' + registrationId, String(error.message || error));
    ui.alert('Email failed: ' + (error.message || error));
  }
}

function setFlatEmailStatus_(registrationId, status) {
  flatSheetDefs_().forEach(function (def) {
    var sheet = getSpreadsheet_().getSheetByName(def.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var last = sheet.getLastRow();
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim() === registrationId) {
        sheet.getRange(i + 2, TLH_FLAT_COL.emailStatus + 1).setValue(status);
      }
    }
  });
  SpreadsheetApp.flush();
}

function deleteTestData() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Delete test data',
    'This removes Team Games and Solo Games rows whose ContactName starts with TEST, plus their Drive folders. Type DELETE to continue.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  if (String(response.getResponseText() || '').trim().toUpperCase() !== 'DELETE') {
    ui.alert('Nothing was deleted. Type DELETE exactly to confirm.');
    return;
  }

  var removed = {};
  flatSheetDefs_().forEach(function (def) {
    var sheet = getSpreadsheet_().getSheetByName(def.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    for (var row = sheet.getLastRow(); row >= 2; row--) {
      var contactName = String(sheet.getRange(row, TLH_FLAT_COL.contactName + 1).getValue() || '').trim();
      if (!/^TEST/i.test(contactName)) continue;
      var registrationId = String(sheet.getRange(row, 1).getValue() || '').trim();
      if (registrationId) removed[registrationId] = contactName;
    }
  });

  var ids = Object.keys(removed);
  ids.forEach(function (registrationId) {
    flatSheetDefs_().forEach(function (def) {
      var sheet = getSpreadsheet_().getSheetByName(def.name);
      if (!sheet) return;
      for (var row = sheet.getLastRow(); row >= 2; row--) {
        if (String(sheet.getRange(row, 1).getValue() || '').trim() === registrationId) {
          sheet.deleteRow(row);
        }
      }
    });
    trashSubmissionFolders_(registrationId, folderSafeName_(registrationId + ' - ' + removed[registrationId]));
  });

  clearConfigCache_();
  logEvent_('INFO', 'deleteTestData', 'Deleted ' + ids.length + ' TEST registrations.', ids.join(', '));
  ui.alert('Deleted ' + ids.length + ' test registration' + (ids.length === 1 ? '' : 's') + '.');
}

function trashSubmissionFolders_(registrationId, folderName) {
  ['payment', 'id'].forEach(function (kind) {
    try {
      var root = getDriveRoot_(kind);
      var folders = root.getFolders();
      while (folders.hasNext()) {
        var folder = folders.next();
        var name = folder.getName();
        if (name === folderName || name.indexOf(registrationId + ' - ') === 0) {
          folder.setTrashed(true);
        }
      }
    } catch (error) {
      logEvent_('ERROR', 'trashSubmissionFolders', 'Could not trash a folder for ' + registrationId, String(error.message || error));
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
    return;
  }
  if (!isFlatSheetName_(name)) return;
  if (e.range.getColumn() !== TLH_FLAT_COL.paymentStatus + 1) return;

  var changes = {};
  var rows = e.range.getNumRows();
  for (var i = 0; i < rows; i++) {
    var row = e.range.getRow() + i;
    if (row < 2) continue;
    var registrationId = String(sheet.getRange(row, 1).getValue() || '').trim();
    if (!registrationId) continue;
    var status = String(sheet.getRange(row, TLH_FLAT_COL.paymentStatus + 1).getValue() || '').trim();
    if (rows === 1 && String(e.oldValue || '').trim() === status) continue;
    if (['Pending', 'Verified', 'Rejected'].indexOf(status) === -1) continue;
    changes[registrationId] = status;
  }

  Object.keys(changes).forEach(function (registrationId) {
    if (paymentStatusUpdateGuarded_(registrationId)) return;
    applyPaymentStatusToRegistration_(registrationId, changes[registrationId], '', { sendEmail: true });
  });
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
