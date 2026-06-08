# Deployment Notes

## Resume Upload Email

The careers form posts to `/api/apply`. Configure these environment variables in production:

```txt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
FROM_EMAIL=your-sending-gmail@gmail.com
HR_EMAIL=hrinfo@mvtechsystems.com
```

`HR_EMAIL` is the address that receives resume submissions. To receive resumes in a Gmail inbox instead, set `HR_EMAIL` to that Gmail address.

If `SMTP_USER` is a Gmail account, create a Google app password and use that value for `SMTP_PASS`.
