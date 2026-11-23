/*
 * TLH Sports Fest 3.0 - web app entry points and API.
 *
 * GET  ?action=config
 * POST {"action":"upload", ...}
 * POST {"action":"submit", ...}
 *
 * Every response is JSON: {ok:true,...} or {ok:false,code,message,fields}.
 */

function doGet(e) {
  try {
    var action = e && e.parameter ? String(e.parameter.action || '') : '';
    if (action === 'config') {
      return ContentService
        .createTextOutput(getPublicConfigJson_())
        .setMimeType(ContentService.MimeType.JSON);
    }
    return jsonOut_(errorPayload_('NOT_FOUND', 'Unknown action. Use ?action=config.'));
  } catch (error) {
    logEvent_('ERROR', 'doGet', String(error.message || error));
    return jsonOut_(errorPayload_('SERVER_ERROR', 'Could not load the event details. Please try again.'));
  }
}

function doPost(e) {
  try {
    var data = parseJsonBody_(e);
    var action = String(data.action || '');
    if (action === 'upload') return jsonOut_(apiUpload_(data));
    if (action === 'submit') return jsonOut_(apiSubmit_(data));
    return jsonOut_(errorPayload_('NOT_FOUND', 'Unknown action.'));
  } catch (error) {
    if (error && error.tlh) {
      return jsonOut_(errorPayload_(error.tlh.code, error.tlh.message, error.tlh.fields, error.tlh.extra));
    }
    logEvent_('ERROR', 'doPost', String(error.message || error));
    return jsonOut_(errorPayload_('SERVER_ERROR', 'Something went wrong. Please try again, or contact the event heads on WhatsApp.'));
  }
}

/* ------------------------------------------------------------------ *
 * Upload
 * ------------------------------------------------------------------ */

function apiUpload_(data) {
  var token = String(data.token || '');
  if (!isValidToken_(token)) {
    return errorPayload_('VALIDATION_FAILED', 'The upload token is missing or invalid. Reload the page and try again.', {
      token: 'Reload the page and try again.'
    });
  }

  var kind = String(data.kind || '');
  if (kind !== 'payment' && kind !== 'id') {
    return errorPayload_('FILE_INVALID', 'Unknown file type.');
  }

  var mimeType = normalizeMime_(data.mimeType);
  if (TLH_ALLOWED_MIME.indexOf(mimeType) === -1) {
    return errorPayload_('FILE_INVALID', 'Upload a JPEG, PNG or WebP image, or a PDF.');
  }

  var raw = String(data.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!raw) {
    return errorPayload_('FILE_INVALID', 'The file was empty. Choose the file again.');
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(raw);
  } catch (error) {
    return errorPayload_('FILE_INVALID', 'The file could not be read. Choose it again.');
  }

  var map = readConfigMap_();
  var maxMB = configNumber_(map, 'MaxFileMB', 5);
  if (!bytes || !bytes.length) {
    return errorPayload_('FILE_INVALID', 'The file was empty. Choose the file again.');
  }
  if (bytes.length > maxMB * 1024 * 1024) {
    return errorPayload_('FILE_INVALID', 'The file is too large. The maximum is ' + maxMB + ' MB after compression.');
  }

  var detected = detectMimeFromBytes_(bytes);
  if (!detected || detected !== mimeType) {
    return errorPayload_('FILE_INVALID', 'The file content does not match its type. Use a JPEG, PNG, WebP image or a PDF.');
  }

  var folder = getPendingFolder_(kind, token, true);
  if (countFilesInFolder_(folder) >= 40) {
    return errorPayload_('RATE_LIMITED', 'Too many files for this form. Reload the page and try again.');
  }

  var tempName = token + '_' + kind + '_' + Date.now() + '.' + extensionForMime_(detected);
  var file;
  try {
    file = folder.createFile(Utilities.newBlob(bytes, detected, tempName));
  } catch (error) {
    logEvent_('ERROR', 'upload', 'Drive createFile failed', String(error.message || error));
    return errorPayload_('SERVER_ERROR', 'The file could not be saved. Please try again.');
  }

  logEvent_('INFO', 'upload', 'Stored a pending ' + kind + ' file for token ' + token.slice(0, 8) + '…', { bytes: bytes.length });
  return { ok: true, fileId: file.getId() };
}

/* ------------------------------------------------------------------ *
 * Submit
 * ------------------------------------------------------------------ */

function apiSubmit_(data) {
  var token = String(data.token || '');
  if (!isValidToken_(token)) {
    return errorPayload_('VALIDATION_FAILED', 'The form token is missing or invalid. Reload the page and try again.', {
      token: 'Reload the page and try again.'
    });
  }

  var cachedResult = getCachedSubmissionResult_(token);
  if (cachedResult) return cachedResult;

  var repeatRows = findFlatRowsByToken_(token);
  if (repeatRows.length) {
    var repeatResult = submissionSuccessFromFlatRows_(repeatRows);
    cacheSubmissionResult_(token, repeatResult);
    return repeatResult;
  }

  // Honeypot: real visitors never fill this field.
  if (String(data.website || '').trim() !== '') {
    return errorPayload_('VALIDATION_FAILED', 'This submission could not be accepted.');
  }

  var nowInfo = getEffectiveNow_();
  var now = nowInfo.date;
  var map = nowInfo.config;
  var state = registrationState(now, map);

  if (state.status === 'NOT_OPEN') {
    return errorPayload_('NOT_OPEN', 'Registration is not open right now. Please contact the event heads for help.');
  }
  if (state.status === 'CLOSED') {
    return errorPayload_('CLOSED', 'Registration closed at the end of ' + formatDateLong(map.RegistrationCloseDate) + '. Please contact the event heads for help.');
  }

  // Minimum form-open time, measured against the real clock (not TestNowOverride).
  var realNow = new Date();
  var loadedAt = parsePktDateTime(data.configLoadedAt);
  if (!loadedAt || realNow.getTime() - loadedAt.getTime() < 30000 || loadedAt.getTime() > realNow.getTime() + 5 * 60 * 1000) {
    return errorPayload_('VALIDATION_FAILED', 'Please take at least 30 seconds to check your details before submitting.', {
      form: 'Wait a moment, then press Submit again.'
    });
  }

  var rawContact = data.contact || {};
  var whatsappKey = normalizeWhatsapp(rawContact.whatsapp);
  var emailKey = String(rawContact.email || '').trim().toLowerCase();
  if (whatsappKey && rateLimitCount_('wa', whatsappKey) >= 5) {
    return errorPayload_('RATE_LIMITED', 'Too many submissions from this WhatsApp number. Try again later, or contact the event heads.');
  }
  if (emailKey && rateLimitCount_('email', emailKey) >= 5) {
    return errorPayload_('RATE_LIMITED', 'Too many submissions from this email address. Try again later, or contact the event heads.');
  }

  var games = getGames_();
  var validation = validateSubmission(data, {
    games: games,
    config: map,
    now: now,
    ageCutoffDate: map.AgeCutoffDate,
    requireIdFiles: true,
    requirePaymentProof: true,
    requireConsent: true
  });

  if (!validation.ok) {
    return errorPayload_('VALIDATION_FAILED', 'Please fix the highlighted fields.', validation.fields);
  }

  var totals = validation.totals;
  var expectedTotal = Number(data.payment && data.payment.expectedTotal);
  if (!isFinite(expectedTotal) || Math.round(expectedTotal) !== Math.round(totals.netTotal)) {
    return errorPayload_('FEE_CHANGED', 'The fee has changed. Review the new total and submit again.', {}, {
      total: totals.netTotal,
      regularTotal: totals.subtotalRegular,
      feeType: totals.feeType,
      entries: totals.lines.map(function (line) {
        return {
          gameId: line.gameId,
          game: line.game,
          fee: line.fee,
          regularFee: line.regularFee
        };
      })
    });
  }

  var paymentFileId = String(data.payment && data.payment.proofFileId || '');
  var paymentFile = findFileInPending_('payment', token, paymentFileId);
  if (!paymentFile) {
    return errorPayload_('FILE_INVALID', 'The payment proof upload was not found. Upload it again.', {
      payment: 'Upload the payment proof again.'
    });
  }

  var idFiles = {};
  for (var i = 0; i < validation.entries.length; i++) {
    var entry = validation.entries[i];
    for (var p = 0; p < entry.players.length; p++) {
      var player = entry.players[p];
      if (!player.idFileId) continue;
      if (!idFiles[player.idFileId]) {
        var idFile = findFileInPending_('id', token, player.idFileId);
        if (!idFile) {
          return errorPayload_('FILE_INVALID', 'An ID document upload was not found. Upload it again.', {
            idFiles: 'Upload the ID document again.'
          });
        }
        idFiles[player.idFileId] = idFile;
      }
    }
  }

  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(30000);
  } catch (error) {
    locked = false;
  }
  if (!locked) {
    return errorPayload_('BUSY', 'The server is busy right now. Please try again in a moment.');
  }

  try {
    // Someone else may have completed the same token while we waited.
    repeatRows = findFlatRowsByToken_(token);
    if (repeatRows.length) {
      var raced = submissionSuccessFromFlatRows_(repeatRows);
      cacheSubmissionResult_(token, raced);
      return raced;
    }

    // Capacity is checked again under the lock so two people cannot take the
    // last place at the same moment.
    var counts = getEntryCounts_();
    var requested = {};
    for (var r = 0; r < validation.entries.length; r++) {
      var requestedGame = validation.entries[r].gameId;
      requested[requestedGame] = (requested[requestedGame] || 0) + 1;
    }
    for (var gameId in requested) {
      if (!Object.prototype.hasOwnProperty.call(requested, gameId)) continue;
      var game = gameById(games, gameId);
      if (game && game.maxEntries && (counts[gameId] || 0) + requested[gameId] > game.maxEntries) {
        var fullFields = {};
        validation.entries.forEach(function (item, index) {
          if (item.gameId === gameId) {
            fullFields['entries[' + index + '].gameId'] = game.name + ' is full. Remove it or choose another game.';
          }
        });
        return errorPayload_('GAME_FULL', game.name + ' is full. Remove it from your selection.', fullFields, {
          games: [gameId]
        });
      }
    }

    var properties = PropertiesService.getScriptProperties();
    var counter = Number(properties.getProperty(TLH_COUNTER_PROPERTY) || '0') + 1;
    var prefix = String(configText_(map, 'ReferencePrefix', 'TSF3')).replace(/[^A-Za-z0-9]/g, '') || 'TSF3';
    var submissionId = prefix + '-' + padNumber_(counter, 4);
    properties.setProperty(TLH_COUNTER_PROPERTY, String(counter));

    var folderName = folderSafeName_(submissionId + ' - ' + validation.contact.name);
    var paymentRoot = getDriveRoot_('payment');
    var idRoot = getDriveRoot_('id');
    var paymentFolder = paymentRoot.createFolder(folderName);
    var idFolder = idRoot.createFolder(folderName);

    paymentFile.setName(submissionId + '_payment.' + extensionForMime_(paymentFile.getMimeType()));
    paymentFile.moveTo(paymentFolder);

    var movedIdFiles = {};
    var playerFileCounter = 0;
    for (var m = 0; m < validation.entries.length; m++) {
      var entryForFiles = validation.entries[m];
      for (var q = 0; q < entryForFiles.players.length; q++) {
        var playerForFile = entryForFiles.players[q];
        if (!playerForFile.idFileId || movedIdFiles[playerForFile.idFileId]) continue;
        playerFileCounter++;
        var fileToMove = idFiles[playerForFile.idFileId];
        var finalIdName = submissionId + '_P' + padNumber_(playerFileCounter, 2) + '_id.' + extensionForMime_(fileToMove.getMimeType());
        fileToMove.setName(finalIdName);
        fileToMove.moveTo(idFolder);
        movedIdFiles[playerForFile.idFileId] = true;
      }
    }

    var entryIds = validation.entries.map(function (item, index) {
      return submissionId + '-' + padNumber_(index + 1, 2);
    });
    var flags = computeDuplicateFlags_(validation.entries, entryIds);
    var paymentProofLink = '=HYPERLINK("' + paymentFile.getUrl() + '","View payment proof")';
    var paymentFolderLink = '=HYPERLINK("' + paymentFolder.getUrl() + '","Open payment folder")';
    var idFolderLink = '=HYPERLINK("' + idFolder.getUrl() + '","Open ID documents")';

    var items = validation.entries.map(function (item, index) {
      return buildFlatRow_({
        registrationId: submissionId,
        entryId: entryIds[index],
        timestamp: now,
        contact: validation.contact,
        gameId: item.gameId,
        game: item.game,
        category: item.category,
        format: item.format,
        ageGroup: item.ageGroup,
        division: item.division,
        teamName: item.teamName,
        players: item.players,
        fee: totals.lines[index].fee,
        regularFee: totals.lines[index].regularFee,
        feeType: totals.feeTypeLabel,
        paymentStatus: 'Pending',
        transactionId: validation.payment.transactionId,
        paymentProof: paymentProofLink,
        verifiedAt: '',
        ageCheck: 'OK',
        flags: flags[entryIds[index]] || '',
        note: '',
        adminNotes: '',
        registrationFolder: paymentFolderLink,
        idFolder: idFolderLink,
        emailStatus: 'PENDING',
        token: token,
        ageCutoffDate: map.AgeCutoffDate
      });
    });

    appendFlatRows_(items);
    SpreadsheetApp.flush();
    clearConfigCache_();

    // Release the lock before sending email so a slow mail quota does not
    // block other families. The registration is already safely written.
    try {
      lock.releaseLock();
    } catch (releaseError) {
      // The finally block will try again.
    }
    locked = false;

    var emailStatus = 'SKIPPED';
    if (configBool_(map, 'SendConfirmationEmails', true)) {
      try {
        var emailData = {
          submissionId: submissionId,
          timestamp: now,
          contact: validation.contact,
          entries: validation.entries.map(function (item, index) {
            return {
              entryId: entryIds[index],
              game: item.game,
              category: item.category,
              format: item.format,
              ageGroup: item.ageGroup,
              division: item.division,
              teamName: item.teamName,
              institution: item.institution,
              players: item.players,
              fee: totals.lines[index].fee
            };
          }),
          totals: totals,
          map: map
        };
        var emailResult = sendConfirmationEmail_(emailData);
        emailStatus = emailResult.sent ? 'SENT' : 'FAILED';
      } catch (emailError) {
        emailStatus = 'FAILED';
        logEvent_('ERROR', 'submitEmail', 'Confirmation email failed for ' + submissionId, String(emailError.message || emailError));
      }
    }
    try {
      setFlatEmailStatus_(submissionId, emailStatus);
    } catch (statusError) {
      // Never fail a registration because the status cell could not be written.
    }

    var success = {
      ok: true,
      submissionId: submissionId,
      feeType: totals.feeType,
      total: totals.netTotal,
      entries: validation.entries.map(function (item, index) {
        return {
          entryId: entryIds[index],
          game: item.game,
          fee: totals.lines[index].fee
        };
      }),
      emailStatus: emailStatus
    };

    rateLimitHit_('wa', whatsappKey);
    rateLimitHit_('email', emailKey);
    cacheSubmissionResult_(token, success);

    logEvent_('INFO', 'submit', 'Created ' + submissionId, {
      entries: validation.entries.length,
      players: validation.entries.reduce(function (sum, item) { return sum + item.players.length; }, 0),
      total: totals.netTotal,
      emailStatus: emailStatus
    });

    return success;
  } finally {
    if (locked) {
      try {
        lock.releaseLock();
      } catch (error) {
        // Nothing else to do.
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Duplicate flags live in FlatSheets.gs because they read the flat tabs.
 * ------------------------------------------------------------------ */

function nameKey_(value) {
  return String(value === null || value === undefined ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}
