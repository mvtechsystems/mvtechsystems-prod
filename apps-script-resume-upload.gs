const DRIVE_FOLDER_ID = '1-wKFJOyTuxljm8CAx1H4hhUOTVP2fanb';
const SHEET_ID = '1ngg9sNA6CqSu83gr0Nd36IpPGltm9EB9L6FG2KcXZGI';
const DEFAULT_HR_EMAIL = 'hrinfo@mvtechsystems.com';
const OPTIONAL_SECRET = '';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (OPTIONAL_SECRET && payload.secret !== OPTIONAL_SECRET) {
      return json({ ok: false, message: 'Unauthorized request.' });
    }

    const candidate = payload.candidate || {};
    const resume = payload.resume || {};
    const hrEmail = payload.hrEmail || DEFAULT_HR_EMAIL;
    const sheetUrl = payload.sheetUrl || 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit';
    const roleLabel = candidate.roleId
      ? candidate.role + ' (' + candidate.roleId + ')'
      : candidate.role || 'Open role';

    const blob = Utilities.newBlob(
      Utilities.base64Decode(resume.base64 || ''),
      resume.mimetype || 'application/octet-stream',
      resume.filename || 'resume'
    );

    const file = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
    const resumeLink = file.getUrl();
    const interviewAvailability = formatInterviewAvailability(candidate.interviewSlots || []);
    const candidateNotes = formatCandidateNotes(candidate);

    SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow([
      new Date(),
      candidate.name || '',
      candidate.email || '',
      candidate.phone || '',
      candidate.role || '',
      candidate.roleId || '',
      candidate.roleLink || '',
      candidateNotes,
      resumeLink,
      '',
      '',
      interviewAvailability
    ]);

    var notificationError = '';
    try {
      sendNotifications({
        candidate,
        hrEmail,
        resumeLink,
        sheetUrl,
        roleLabel
      });
    } catch (notificationFailure) {
      notificationError = String(notificationFailure.message || notificationFailure);
      console.error('Email notification failed: ' + notificationError);
    }

    return json({ ok: true, resumeLink, notificationError });
  } catch (error) {
    return json({ ok: false, message: String(error.message || error) });
  }
}

function sendNotifications(details) {
  const candidate = details.candidate || {};

  MailApp.sendEmail({
    to: details.hrEmail,
    subject: 'New resume submission - ' + details.roleLabel,
    body: [
      'A new candidate submitted a resume.',
      '',
      'Name: ' + (candidate.name || ''),
      'Email: ' + (candidate.email || ''),
      'Phone: ' + (candidate.phone || ''),
      'Role: ' + (candidate.role || ''),
      'Role ID: ' + (candidate.roleId || ''),
      'Role Link: ' + (candidate.roleLink || ''),
      'Target Role: ' + (candidate.otherRole || 'Not provided'),
      'Mandatory Skillset: ' + (candidate.skillset || 'Not provided'),
      'Interview Availability:',
      formatInterviewAvailability(candidate.interviewSlots || []) || 'Not provided',
      'Resume Link: ' + details.resumeLink,
      'Google Sheet: ' + details.sheetUrl,
      '',
      'Candidate Notes:',
      candidate.message || 'No notes provided.'
    ].join('\n')
  });

  if (candidate.email) {
    MailApp.sendEmail({
      to: candidate.email,
      subject: 'MV Tech Systems received your resume',
      body: [
        'Hi ' + (candidate.name || 'there') + ',',
        '',
        'Thank you for submitting your resume for ' + details.roleLabel + '.',
        'Our recruiting team has received your application and will review your profile for matching opportunities.',
        'If your experience aligns with an open role, we will contact you with next steps.',
        '',
        'MV Tech Systems Recruiting'
      ].join('\n')
    });
  }
}

function formatInterviewAvailability(interviewSlots) {
  return (interviewSlots || [])
    .filter(function(slot) {
      return Boolean(slot);
    })
    .map(function(slot, index) {
      return 'Slot ' + (index + 1) + ': ' + slot + ' (1 hour)';
    })
    .join('\n');
}

function formatCandidateNotes(candidate) {
  return [
    candidate.otherRole ? 'Target Role: ' + candidate.otherRole : '',
    candidate.skillset ? 'Mandatory Skillset: ' + candidate.skillset : '',
    candidate.message || ''
  ].filter(function(value) {
    return Boolean(value);
  }).join('\n');
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
