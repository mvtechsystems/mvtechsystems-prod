# Deployment Notes

## Resume Upload Storage

The careers form posts to `/api/apply`. Configure these environment variables in production:

```txt
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=1-wKFJOyTuxljm8CAx1H4hhUOTVP2fanb
GOOGLE_SHEET_ID=your-google-sheet-id
```

`GOOGLE_DRIVE_FOLDER_ID` is currently set to the provided Drive folder:

```txt
1-wKFJOyTuxljm8CAx1H4hhUOTVP2fanb
```

Create a Google service account, then share the Drive folder and candidate Google Sheet with the service account email using Editor access. Candidates do not need to sign in to Google.

## Resume Upload Email

Email notifications are optional but recommended. Configure these variables to send HR notifications and candidate acknowledgments:

```txt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
FROM_EMAIL=your-sending-gmail@gmail.com
HR_EMAIL=mvtechsystems@gmail.com
```

`HR_EMAIL` is the address that receives resume submissions. Current target: `mvtechsystems@gmail.com`.

If `SMTP_USER` is a Gmail account, create a Google app password and use that value for `SMTP_PASS`.

Do not use or share the normal Gmail password.
