/*
 * TLH Sports Fest 3.0 - HTML emails.
 *
 * Inline CSS only, brand colours, no remote images. Sender name is
 * "TLH Sports Fest". A failure to send must never fail a registration.
 */

function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replyToAddress_(map) {
  var support = configText_(map, 'SupportEmail', '');
  if (support && isValidEmail(support)) return support;
  try {
    var email = Session.getEffectiveUser().getEmail();
    if (email && isValidEmail(email)) return email;
  } catch (error) {
    // Some contexts have no user email.
  }
  return '';
}

function emailContactsHtml_(map) {
  var contacts = getContactList_(map);
  return contacts.map(function (contact) {
    var links = [];
    if (contact.tel) links.push('<a href="' + escapeHtml_(contact.tel) + '" style="color:#A00509;text-decoration:none;">Call ' + escapeHtml_(contact.phone) + '</a>');
    if (contact.whatsapp) links.push('<a href="' + escapeHtml_(contact.whatsapp) + '" style="color:#A00509;text-decoration:none;">WhatsApp</a>');
    return '<div style="margin:0 0 10px;">' +
      '<strong style="color:#2D0C03;">' + escapeHtml_(contact.name) + '</strong>' +
      '<span style="color:#5C2600;"> · ' + escapeHtml_(contact.role) + '</span><br>' +
      '<span style="color:#5C2600;">' + escapeHtml_(contact.phone) + '</span><br>' +
      links.join(' &nbsp;·&nbsp; ') +
      '</div>';
  }).join('');
}

function emailBankHtml_(map, amount) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FFF8F0;border:1px solid #F8AA14;border-radius:12px;">' +
    '<tr><td style="padding:14px 16px;font-size:13px;color:#5C2600;">Bank</td><td style="padding:14px 16px;font-size:14px;font-weight:600;color:#161012;text-align:right;">' + escapeHtml_(configText_(map, 'BankName', '')) + '</td></tr>' +
    '<tr><td style="padding:14px 16px;font-size:13px;color:#5C2600;border-top:1px solid #F1D7B8;">Account title</td><td style="padding:14px 16px;font-size:14px;font-weight:600;color:#161012;text-align:right;border-top:1px solid #F1D7B8;">' + escapeHtml_(configText_(map, 'AccountTitle', '')) + '</td></tr>' +
    '<tr><td style="padding:14px 16px;font-size:13px;color:#5C2600;border-top:1px solid #F1D7B8;">IBAN</td><td style="padding:14px 16px;font-size:14px;font-weight:600;color:#161012;text-align:right;border-top:1px solid #F1D7B8;letter-spacing:0.5px;">' + escapeHtml_(groupIban(configText_(map, 'IBAN', ''))) + '</td></tr>' +
    '<tr><td style="padding:14px 16px;font-size:13px;color:#5C2600;border-top:1px solid #F1D7B8;">Amount</td><td style="padding:14px 16px;font-size:18px;font-weight:800;color:#A00509;text-align:right;border-top:1px solid #F1D7B8;">' + escapeHtml_(formatPKR(amount)) + '</td></tr>' +
    '</table>';
}

function emailEntriesTable_(data) {
  var rows = (data.entries || []).map(function (entry) {
    var meta = [entry.ageGroup, entry.division].filter(Boolean).join(' · ');
    var team = entry.teamName ? '<div style="font-size:12px;color:#5C2600;margin-top:2px;">Team: ' + escapeHtml_(entry.teamName) + '</div>' : '';
    return '<tr>' +
      '<td style="padding:12px 8px;border-bottom:1px solid #F1D7B8;vertical-align:top;">' +
      '<strong style="color:#161012;">' + escapeHtml_(entry.game) + '</strong>' +
      '<div style="font-size:12px;color:#5C2600;margin-top:2px;">' + escapeHtml_(meta) + '</div>' + team +
      '</td>' +
      '<td style="padding:12px 8px;border-bottom:1px solid #F1D7B8;text-align:center;color:#161012;">' + (entry.players ? entry.players.length : '') + '</td>' +
      '<td style="padding:12px 8px;border-bottom:1px solid #F1D7B8;text-align:right;font-weight:600;color:#161012;white-space:nowrap;">' + escapeHtml_(formatPKR(entry.fee)) + '</td>' +
      '</tr>';
  }).join('');

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">' +
    '<thead><tr>' +
    '<th style="text-align:left;padding:8px;background:#FFE0C2;color:#5C2600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Game</th>' +
    '<th style="text-align:center;padding:8px;background:#FFE0C2;color:#5C2600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Players</th>' +
    '<th style="text-align:right;padding:8px;background:#FFE0C2;color:#5C2600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Fee</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function emailTotalsHtml_(data) {
  var totals = data.totals || {};
  var lines = '';
  if (totals.savings > 0) {
    lines += '<tr><td style="padding:4px 0;color:#5C2600;font-size:13px;">Regular total</td><td style="padding:4px 0;text-align:right;color:#8A6A55;text-decoration:line-through;font-size:13px;">' + escapeHtml_(formatPKR(totals.subtotalRegular)) + '</td></tr>';
    lines += '<tr><td style="padding:4px 0;color:#155724;font-size:13px;">Early bird saving</td><td style="padding:4px 0;text-align:right;color:#155724;font-size:13px;font-weight:600;">− ' + escapeHtml_(formatPKR(totals.savings)) + '</td></tr>';
  }
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">' + lines +
    '<tr><td style="padding:10px 0 0;border-top:1px solid #F1D7B8;font-size:16px;font-weight:800;color:#161012;">Net total</td><td style="padding:10px 0 0;border-top:1px solid #F1D7B8;text-align:right;font-size:22px;font-weight:800;color:#A00509;">' + escapeHtml_(formatPKR(totals.netTotal)) + '</td></tr>' +
    '</table>';
}

function emailShell_(heading, subheading, contentHtml, map) {
  var socials = configText_(map, 'SocialsNotice', '');
  return '<!doctype html><html><body style="margin:0;padding:0;background:#FFF8F0;font-family:Arial,Helvetica,sans-serif;color:#161012;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #F1D7B8;">' +
    '<tr><td style="background:linear-gradient(180deg,#A00509 0%,#C83806 45%,#E45C06 100%);padding:30px 24px;text-align:center;color:#FFFFFF;">' +
    '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.9;">TLH Sports Fest 3.0 · III Edition</div>' +
    '<div style="font-size:30px;font-weight:800;line-height:1.15;margin-top:8px;">' + escapeHtml_(heading) + '</div>' +
    '<div style="font-size:13px;margin-top:10px;opacity:0.95;">' + escapeHtml_(subheading) + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:26px 24px;">' + contentHtml + '</td></tr>' +
    '<tr><td style="padding:18px 24px;background:#FFF3E4;border-top:1px solid #F1D7B8;">' +
    (socials ? '<div style="background:#FFE0C2;border-left:4px solid #E45C06;padding:12px 14px;font-size:13px;color:#5C2600;margin-bottom:16px;">' + escapeHtml_(socials) + '</div>' : '') +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#A00509;font-weight:700;margin-bottom:8px;">Event heads</div>' +
    emailContactsHtml_(map) +
    '<div style="font-size:11px;color:#8A6A55;margin-top:14px;">This is an automated email from TLH Sports Fest 3.0. Sat 30 and Sun 31 January 2027 · TLH Canal Campus.</div>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function sendConfirmationEmail_(data) {
  try {
    var map = data.map || readConfigMap_();
    if (!data.contact || !isValidEmail(data.contact.email)) {
      return { sent: false, error: 'No valid email address.' };
    }
    var socials = configText_(map, 'SocialsNotice', '');
    var content =
      '<p style="margin:0 0 14px;font-size:15px;">Assalam-o-Alaikum ' + escapeHtml_(data.contact.name) + ',</p>' +
      '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3A2A22;">Thank you. We have received your registration for TLH Sports Fest 3.0.</p>' +
      '<div style="background:#FFF3CD;border:1px solid #F8AA14;border-radius:12px;padding:16px;text-align:center;margin:18px 0;">' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5C2600;">Your submission ID</div>' +
      '<div style="font-size:30px;font-weight:800;letter-spacing:1px;color:#5C2600;margin-top:4px;">' + escapeHtml_(data.submissionId) + '</div>' +
      '</div>' +
      '<div style="background:#FFF8F0;border:1px solid #F1D7B8;border-radius:12px;padding:14px 16px;margin:0 0 18px;">' +
      '<strong style="color:#5C2600;">Status: Pending verification.</strong><br>' +
      '<span style="font-size:13px;color:#5C2600;">We will check your payment proof and email you when it is verified. Keep this ID for any questions.</span>' +
      '</div>' +
      '<h2 style="font-size:16px;color:#A00509;margin:20px 0 10px;">Your entries</h2>' +
      emailEntriesTable_(data) +
      emailTotalsHtml_(data) +
      '<h2 style="font-size:16px;color:#A00509;margin:24px 0 10px;">Payment details</h2>' +
      emailBankHtml_(map, data.totals.netTotal) +
      (socials ? '<div style="background:#FFE0C2;border-left:4px solid #E45C06;padding:12px 14px;font-size:13px;color:#5C2600;margin-top:18px;">' + escapeHtml_(socials) + '</div>' : '');

    var html = emailShell_(
      'Registration received',
      'Sat 30 and Sun 31 January 2027 · TLH Canal Campus',
      content,
      map
    );

    var entryLines = (data.entries || []).map(function (entry) {
      return '• ' + entry.game + ' (' + entry.ageGroup + ', ' + entry.division + ') — ' + formatPKR(entry.fee);
    }).join('\n');
    var contactLines = getContactList_(map).map(function (contact) {
      return contact.name + ' (' + contact.role + '): ' + contact.phone + (contact.whatsapp ? ' · ' + contact.whatsapp : '');
    }).join('\n');

    var plain = [
      'TLH Sports Fest 3.0 — Registration received',
      '',
      'Assalam-o-Alaikum ' + data.contact.name + ',',
      '',
      'Thank you. We have received your registration.',
      'Submission ID: ' + data.submissionId,
      'Status: Pending verification.',
      '',
      'Entries:',
      entryLines,
      '',
      'Net total: ' + formatPKR(data.totals.netTotal),
      '',
      'Bank: ' + configText_(map, 'BankName', ''),
      'Account title: ' + configText_(map, 'AccountTitle', ''),
      'IBAN: ' + configText_(map, 'IBAN', ''),
      'Amount: ' + formatPKR(data.totals.netTotal),
      '',
      socials,
      '',
      'Event heads:',
      contactLines,
      '',
      'Sat 30 and Sun 31 January 2027 · TLH Canal Campus'
    ].join('\n');

    var options = {
      to: data.contact.email,
      subject: 'TLH Sports Fest 3.0 — Registration received (' + data.submissionId + ')',
      body: plain,
      htmlBody: html,
      name: 'TLH Sports Fest'
    };
    var replyTo = replyToAddress_(map);
    if (replyTo) options.replyTo = replyTo;
    MailApp.sendEmail(options);
    return { sent: true };
  } catch (error) {
    return { sent: false, error: String(error.message || error) };
  }
}

function sendStatusEmail_(data, status, note) {
  var map = data.map || readConfigMap_();
  var verified = status === 'Verified';
  var heading = verified ? 'Payment verified' : 'Payment needs attention';
  var intro = verified
    ? 'Your payment has been verified. Your place at TLH Sports Fest 3.0 is confirmed.'
    : 'We could not verify your payment proof. Please contact the event heads so we can help.';

  var noteHtml = '';
  if (!verified && note) {
    noteHtml = '<div style="background:#F8D7DA;border-left:4px solid #A00509;padding:12px 14px;margin:16px 0;font-size:14px;color:#721C24;">' +
      '<strong>Note from the event team:</strong><br>' + escapeHtml_(note).replace(/\n/g, '<br>') + '</div>';
  }

  var content =
    '<p style="margin:0 0 14px;font-size:15px;">Assalam-o-Alaikum ' + escapeHtml_(data.contact.name) + ',</p>' +
    '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3A2A22;">' + escapeHtml_(intro) + '</p>' +
    '<div style="background:' + (verified ? '#D4EDDA' : '#F8D7DA') + ';border:1px solid ' + (verified ? '#9BC7A5' : '#E8A6AD') + ';border-radius:12px;padding:14px 16px;margin:16px 0;">' +
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:' + (verified ? '#155724' : '#721C24') + ';">' + escapeHtml_(status) + '</div>' +
    '<div style="font-size:24px;font-weight:800;color:' + (verified ? '#155724' : '#721C24') + ';">' + escapeHtml_(data.submissionId) + '</div>' +
    '</div>' +
    noteHtml +
    '<h2 style="font-size:16px;color:#A00509;margin:22px 0 10px;">Your entries</h2>' +
    emailEntriesTable_(data) +
    emailTotalsHtml_(data) +
    (verified ? '<p style="font-size:13px;color:#5C2600;margin-top:16px;">Please keep your submission ID handy on event day.</p>' : '') +
    (configText_(map, 'SocialsNotice', '') ? '<div style="background:#FFE0C2;border-left:4px solid #E45C06;padding:12px 14px;font-size:13px;color:#5C2600;margin-top:18px;">' + escapeHtml_(configText_(map, 'SocialsNotice', '')) + '</div>' : '');

  var html = emailShell_(heading, 'Sat 30 and Sun 31 January 2027 · TLH Canal Campus', content, map);
  var plain = [
    'TLH Sports Fest 3.0 — ' + heading,
    '',
    'Assalam-o-Alaikum ' + data.contact.name + ',',
    '',
    intro,
    'Submission ID: ' + data.submissionId,
    'Status: ' + status,
    note ? 'Note: ' + note : '',
    '',
    'Net total: ' + formatPKR(data.totals.netTotal),
    '',
    'Event heads:',
    getContactList_(map).map(function (contact) {
      return contact.name + ': ' + contact.phone + (contact.whatsapp ? ' · ' + contact.whatsapp : '');
    }).join('\n')
  ].filter(function (line) { return line !== ''; }).join('\n');

  var options = {
    to: data.contact.email,
    subject: 'TLH Sports Fest 3.0 — ' + heading + ' (' + data.submissionId + ')',
    body: plain,
    htmlBody: html,
    name: 'TLH Sports Fest'
  };
  var replyTo = replyToAddress_(map);
  if (replyTo) options.replyTo = replyTo;
  MailApp.sendEmail(options);
  return { sent: true };
}

/**
 * Rebuilds the data needed by the emails from the Sheet. Used by status
 * emails and by the Resend confirmation menu item.
 */
function buildEmailDataFromSheet_(submissionId) {
  var rowNumber = findSubmissionRowById_(submissionId);
  if (!rowNumber) return null;
  var values = getSheet_('Submissions').getRange(rowNumber, 1, 1, 20).getValues()[0];
  var map = readConfigMap_();

  var entries = [];
  var byEntryId = {};
  var entriesSheet = getSheet_('Entries');
  var lastEntry = entriesSheet.getLastRow();
  if (lastEntry >= 2) {
    var entryValues = entriesSheet.getRange(2, 1, lastEntry - 1, 18).getValues();
    for (var i = 0; i < entryValues.length; i++) {
      if (String(entryValues[i][1] || '') !== submissionId) continue;
      var entry = {
        entryId: String(entryValues[i][0] || ''),
        game: String(entryValues[i][4] || ''),
        category: String(entryValues[i][5] || ''),
        format: String(entryValues[i][6] || ''),
        ageGroup: String(entryValues[i][7] || ''),
        division: String(entryValues[i][8] || ''),
        teamName: String(entryValues[i][9] || ''),
        institution: String(entryValues[i][10] || ''),
        fee: Number(entryValues[i][12]) || 0,
        players: []
      };
      entries.push(entry);
      byEntryId[entry.entryId] = entry;
    }
  }

  var playersSheet = getSheet_('Players');
  var lastPlayer = playersSheet.getLastRow();
  if (lastPlayer >= 2) {
    var playerValues = playersSheet.getRange(2, 1, lastPlayer - 1, 13).getValues();
    for (var p = 0; p < playerValues.length; p++) {
      if (String(playerValues[p][2] || '') !== submissionId) continue;
      var parent = byEntryId[String(playerValues[p][1] || '')];
      if (!parent) continue;
      parent.players.push({
        name: String(playerValues[p][8] || ''),
        dob: parseDateOnly(playerValues[p][9]),
        role: String(playerValues[p][7] || ''),
        idNumber: String(playerValues[p][11] || '')
      });
    }
  }

  var regularTotal = Number(values[9]) || 0;
  var netTotal = Number(values[10]) || 0;
  return {
    submissionId: submissionId,
    timestamp: values[1],
    paymentStatus: String(values[13] || ''),
    contact: {
      name: String(values[2] || ''),
      role: String(values[3] || ''),
      whatsapp: String(values[4] || ''),
      email: String(values[5] || ''),
      institution: String(values[6] || '')
    },
    entries: entries,
    totals: {
      subtotalRegular: regularTotal,
      netTotal: netTotal,
      savings: Math.max(0, regularTotal - netTotal),
      feeTypeLabel: String(values[8] || ''),
      feeType: String(values[8] || '') === 'Early Bird' ? 'EARLY_BIRD' : 'REGULAR'
    },
    map: map
  };
}
