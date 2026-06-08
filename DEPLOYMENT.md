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
HR_EMAIL=mvtechsystems@gmail.com
```

`HR_EMAIL` is the address that receives resume submissions. Current target: `mvtechsystems@gmail.com`.

If `SMTP_USER` is a Gmail account, create a Google app password and use that value for `SMTP_PASS`.
