# Deployment Notes

## Resume Upload Storage

The careers form posts to `/api/apply`. Configure these environment variables in production:

### Recommended: Google Apps Script

Use this option for a normal Gmail Drive folder. It does not require candidates to sign in to Google.

```txt
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
APPS_SCRIPT_SECRET=optional-shared-secret
HR_EMAIL=hrinfo@mvtechsystems.com
```

Deploy this Apps Script as a Web App using **Execute as: Me** and **Who has access: Anyone**:

```js
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

    SpreadsheetApp.openById(SHEET_ID).getSheets()[0].appendRow([
      new Date(),
      candidate.name || '',
      candidate.email || '',
      candidate.phone || '',
      candidate.role || '',
      candidate.roleId || '',
      candidate.roleLink || '',
      candidate.message || '',
      resumeLink
    ]);

    sendNotifications({
      candidate,
      hrEmail,
      resumeLink,
      sheetUrl,
      roleLabel
    });

    return json({ ok: true, resumeLink });
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

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Alternative: Google Service Account

Use this only when uploading to a Google Shared Drive or when using Google Workspace delegation. Service accounts cannot upload into a normal Gmail "My Drive" folder because they do not have Drive storage quota.

```txt
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1-wKFJOyTuxljm8CAx1H4hhUOTVP2fanb
GOOGLE_SHEET_ID=1ngg9sNA6CqSu83gr0Nd36IpPGltm9EB9L6FG2KcXZGI
```

`GOOGLE_DRIVE_FOLDER_ID` is currently set to the provided Drive folder:

```txt
1-wKFJOyTuxljm8CAx1H4hhUOTVP2fanb
```

Create a Google service account, then share the Drive folder and candidate Google Sheet with the service account email using Editor access. Candidates do not need to sign in to Google.

`GOOGLE_SHEET_ID` is currently set to the provided candidate sheet:

```txt
1ngg9sNA6CqSu83gr0Nd36IpPGltm9EB9L6FG2KcXZGI
```

## Resume Upload Email

Email notifications are optional but recommended. Configure these variables to send HR notifications and candidate acknowledgments:

```txt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
FROM_EMAIL=your-sending-gmail@gmail.com
HR_EMAIL=hrinfo@mvtechsystems.com
```

`HR_EMAIL` is the address that receives resume submissions. Current target: `hrinfo@mvtechsystems.com`.

If `SMTP_USER` is a Gmail account, create a Google app password and use that value for `SMTP_PASS`.

Do not use or share the normal Gmail password.
