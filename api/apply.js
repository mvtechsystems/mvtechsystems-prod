const fs = require('fs/promises');
const { IncomingForm } = require('formidable');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const MAX_RESUME_SIZE = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

function readField(fields, name) {
    const value = fields[name];
    return Array.isArray(value) ? value[0] || '' : value || '';
}

function normalizeFile(files, name) {
    const value = files[name];
    return Array.isArray(value) ? value[0] : value;
}

function parseMultipart(req) {
    const form = new IncomingForm({
        multiples: false,
        maxFileSize: MAX_RESUME_SIZE,
        keepExtensions: true
    });

    return new Promise((resolve, reject) => {
        form.parse(req, (error, fields, files) => {
            if (error) {
                reject(error);
                return;
            }

            resolve({ fields, files });
        });
    });
}

function createTransport() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass }
    });
}

function formatSender(email, name) {
    if (!email) {
        return '';
    }

    const label = name || 'MV Tech Systems No Reply';
    return `${label} <${email}>`;
}

function createGoogleAuth() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        return null;
    }

    return new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });
}

function getMissingGoogleStorageEnv() {
    return [
        'GOOGLE_CLIENT_EMAIL',
        'GOOGLE_PRIVATE_KEY',
        'GOOGLE_DRIVE_FOLDER_ID'
    ].filter(name => !process.env[name]);
}

function createReadableStream(buffer) {
    const { Readable } = require('stream');
    return Readable.from(buffer);
}

function getAppsScriptUrl() {
    return process.env.GOOGLE_APPS_SCRIPT_URL || process.env.APPS_SCRIPT_URL || '';
}

function getGoogleErrorMessage(error, step) {
    const status = error?.code || error?.response?.status;
    const reason = error?.errors?.[0]?.reason || error?.response?.data?.error;
    const message = error?.errors?.[0]?.message || error?.response?.data?.error_description || error?.message || '';
    const detail = [reason, message]
        .filter(Boolean)
        .map(value => String(value).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(': ')
        .slice(0, 260);

    if (status === 403) {
        return `${step} failed: permission denied${detail ? ` (${detail})` : ''}. Share Drive folder ${process.env.GOOGLE_DRIVE_FOLDER_ID || ''} and the Google Sheet with ${process.env.GOOGLE_CLIENT_EMAIL || 'the service account'} as Editor, and confirm Drive/Sheets APIs are enabled.`;
    }

    if (status === 404) {
        return `${step} failed: Google file or folder was not found. Check the Drive folder ID, Sheet ID, and sharing access for the service account.`;
    }

    if (status === 400 && message.toLowerCase().includes('invalid_grant')) {
        return `${step} failed: Google private key or service account credentials are invalid. Recreate the service account key and update Vercel env vars.`;
    }

    if (reason || status) {
        return `${step} failed: Google API returned ${status || 'an error'}${reason ? ` (${reason})` : ''}. Check Google API access and sharing.`;
    }

    return `${step} failed. Check Google Drive/Sheets sharing, enabled APIs, and Vercel environment variables.`;
}

function getUnexpectedErrorMessage(error) {
    const status = error?.code || error?.httpCode || error?.response?.status;
    const rawMessage = String(error?.message || 'Unknown backend error');
    const safeMessage = rawMessage
        .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[redacted private key]')
        .slice(0, 220);

    if (status) {
        return `Resume upload failed before storage step: ${status} - ${safeMessage}. Please email your resume directly to hrinfo@mvtechsystems.com.`;
    }

    return `Resume upload failed before storage step: ${safeMessage}. Please email your resume directly to hrinfo@mvtechsystems.com.`;
}

async function uploadResumeToDrive(auth, resumeContent, filename, mimetype) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!auth || !folderId) {
        return null;
    }

    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
            name: filename,
            parents: [folderId]
        },
        media: {
            mimeType: mimetype,
            body: createReadableStream(resumeContent)
        },
        fields: 'id, webViewLink'
    });

    return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
}

async function submitToAppsScript(candidate, resumeContent, filename, mimetype, hrEmail) {
    const scriptUrl = getAppsScriptUrl();

    if (!scriptUrl) {
        return null;
    }

    const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            secret: process.env.APPS_SCRIPT_SECRET || '',
            hrEmail,
            sheetUrl: process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit` : '',
            candidate,
            resume: {
                filename,
                mimetype,
                base64: resumeContent.toString('base64')
            }
        })
    });

    const responseText = await response.text();
    let payload;

    try {
        payload = JSON.parse(responseText);
    } catch (error) {
        throw new Error(`Apps Script returned an invalid response: ${responseText.slice(0, 180)}`);
    }

    if (!response.ok || !payload.ok) {
        throw new Error(payload.message || `Apps Script failed with status ${response.status}`);
    }

    return payload.resumeLink || '';
}

function formatInterviewAvailability(interviewSlots) {
    return (interviewSlots || [])
        .filter(Boolean)
        .map((slot, index) => `Slot ${index + 1}: ${slot} (1 hour)`)
        .join('\n');
}

function formatCandidateNotes(candidate) {
    return [
        candidate.otherRole ? `Target Role: ${candidate.otherRole}` : '',
        candidate.skillset ? `Mandatory Skillset: ${candidate.skillset}` : '',
        candidate.message || ''
    ].filter(Boolean).join('\n');
}

async function appendCandidateToSheet(auth, candidate, resumeLink) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!auth || !spreadsheetId) {
        return;
    }

    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:L',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                new Date().toISOString(),
                candidate.name,
                candidate.email,
                candidate.phone || '',
                candidate.role,
                candidate.roleId || '',
                candidate.roleLink || '',
                formatCandidateNotes(candidate),
                resumeLink || '',
                '',
                '',
                formatInterviewAvailability(candidate.interviewSlots)
            ]]
        }
    });
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { ok: false, message: 'Method not allowed' });
        return;
    }

    const googleAuth = createGoogleAuth();
    const hasGoogleStorage = Boolean(googleAuth && process.env.GOOGLE_DRIVE_FOLDER_ID);
    const hasAppsScriptStorage = Boolean(getAppsScriptUrl());
    const transport = createTransport();

    if (!hasAppsScriptStorage && !hasGoogleStorage && !transport) {
        const missingGoogleEnv = getMissingGoogleStorageEnv();
        const missingText = missingGoogleEnv.length ? ` Missing: ${missingGoogleEnv.join(', ')}.` : '';
        sendJson(res, 503, { ok: false, message: `Resume upload is not configured yet. Add GOOGLE_APPS_SCRIPT_URL or configure Google service-account storage.${missingText} Please email your resume directly to hrinfo@mvtechsystems.com.` });
        return;
    }

    try {
        const { fields, files } = await parseMultipart(req);

        if (readField(fields, 'company_website')) {
            sendJson(res, 200, { ok: true });
            return;
        }

        const name = readField(fields, 'name').trim();
        const email = readField(fields, 'email').trim();
        const phone = readField(fields, 'phone').trim();
        const role = readField(fields, 'role').trim();
        const roleId = readField(fields, 'role_id').trim();
        const roleLink = readField(fields, 'role_link').trim();
        const otherRole = readField(fields, 'other_role').trim();
        const skillset = readField(fields, 'skillset').trim();
        const interviewSlots = [
            readField(fields, 'interview_slot_1').trim(),
            readField(fields, 'interview_slot_2').trim(),
            readField(fields, 'interview_slot_3').trim(),
            readField(fields, 'interview_slot_4').trim(),
            readField(fields, 'interview_slot_5').trim()
        ].filter(Boolean);
        const message = readField(fields, 'message').trim();
        const resume = normalizeFile(files, 'resume');

        if (!name || !email || !role || !resume) {
            sendJson(res, 400, { ok: false, message: 'Missing required application fields.' });
            return;
        }

        if (roleId === 'MVTS-OTHER-UNIVERSAL' && (!otherRole || !skillset)) {
            sendJson(res, 400, { ok: false, message: 'Target role and mandatory skillset are required for universal resume upload.' });
            return;
        }

        if (interviewSlots.length < 3) {
            sendJson(res, 400, { ok: false, message: 'Please provide at least 3 available 1-hour interview slots.' });
            return;
        }

        if (interviewSlots.length > 5) {
            sendJson(res, 400, { ok: false, message: 'Please provide no more than 5 interview slots.' });
            return;
        }

        const filename = resume.originalFilename || 'resume';
        const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
        const mimetype = resume.mimetype || '';

        if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(mimetype)) {
            sendJson(res, 400, { ok: false, message: 'Resume must be a PDF or DOCX file.' });
            return;
        }

        const resumeContent = await fs.readFile(resume.filepath);
        const hrEmail = process.env.HR_EMAIL || 'hrinfo@mvtechsystems.com';
        const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
        const fromName = process.env.FROM_NAME || 'MV Tech Systems No Reply';
        const fromAddress = formatSender(fromEmail, fromName);
        const sheetLink = process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit` : '';
        const roleLabel = roleId ? `${role} (${roleId})` : role;
        const candidate = { name, email, phone, role, roleId, roleLink, otherRole, skillset, interviewSlots, message };
        let resumeLink;

        if (hasAppsScriptStorage) {
            try {
                resumeLink = await submitToAppsScript(candidate, resumeContent, filename, mimetype, hrEmail);
            } catch (error) {
                console.error(error);
                sendJson(res, 500, { ok: false, message: `Resume upload failed in Google Apps Script: ${String(error.message || error).slice(0, 220)}. Please email your resume directly to hrinfo@mvtechsystems.com.` });
                return;
            }
        } else {
            try {
                resumeLink = await uploadResumeToDrive(googleAuth, resumeContent, filename, mimetype);
            } catch (error) {
                console.error(error);
                sendJson(res, 500, { ok: false, message: getGoogleErrorMessage(error, 'Drive upload') });
                return;
            }

            try {
                await appendCandidateToSheet(googleAuth, candidate, resumeLink);
            } catch (error) {
                console.error(error);
                sendJson(res, 500, { ok: false, message: getGoogleErrorMessage(error, 'Sheet update') });
                return;
            }
        }

        if (transport) {
            try {
                await transport.sendMail({
                    from: fromAddress,
                    to: hrEmail,
                    replyTo: email,
                    subject: `New resume submission - ${roleLabel}`,
                    text: [
                        `Name: ${name}`,
                        `Email: ${email}`,
                        `Phone: ${phone || 'Not provided'}`,
                        `Role: ${role}`,
                        `Role ID: ${roleId || 'Not provided'}`,
                        `Role Link: ${roleLink || 'Not provided'}`,
                        `Target Role: ${otherRole || 'Not provided'}`,
                        `Mandatory Skillset: ${skillset || 'Not provided'}`,
                        'Interview Availability:',
                        formatInterviewAvailability(interviewSlots) || 'Not provided',
                        `Resume Drive Link: ${resumeLink || 'Not stored in Drive'}`,
                        `Google Sheet Link: ${sheetLink || 'Not configured'}`,
                        '',
                        'Candidate Notes:',
                        message || 'No notes provided.'
                    ].join('\n'),
                    attachments: [
                        {
                            filename,
                            content: resumeContent,
                            contentType: mimetype
                        }
                    ]
                });

                await transport.sendMail({
                    from: fromAddress,
                    to: email,
                    subject: 'MV Tech Systems received your resume',
                    text: [
                        `Hi ${name},`,
                        '',
                        `Thank you for submitting your resume for ${roleLabel}.`,
                        'Our recruiting team has received your application and will review your profile for matching opportunities.',
                        'If your experience aligns with an open role, we will contact you with next steps.',
                        '',
                        'MV Tech Systems Recruiting'
                    ].join('\n')
                });
            } catch (error) {
                console.error('Resume email notification failed:', error);
            }
        }

        sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { ok: false, message: getUnexpectedErrorMessage(error) });
    }
};
