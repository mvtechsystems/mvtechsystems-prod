const fs = require('fs/promises');
const formidable = require('formidable');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const MAX_RESUME_SIZE = 10 * 1024 * 1024;
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
    const form = formidable({
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
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });
}

function createReadableStream(buffer) {
    const { Readable } = require('stream');
    return Readable.from(buffer);
}

async function uploadResumeToDrive(auth, resumeContent, filename, mimetype) {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!auth || !folderId) {
        return null;
    }

    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.create({
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

    await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone'
        }
    });

    return response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`;
}

async function appendCandidateToSheet(auth, candidate, resumeLink) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!auth || !spreadsheetId) {
        return;
    }

    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:I',
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
                candidate.message || '',
                resumeLink || ''
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
    const transport = createTransport();

    if (!hasGoogleStorage && !transport) {
        sendJson(res, 503, { ok: false, message: 'Resume upload is not configured yet. Please email your resume directly to mvtechsystems@gmail.com.' });
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
        const message = readField(fields, 'message').trim();
        const resume = normalizeFile(files, 'resume');

        if (!name || !email || !role || !resume) {
            sendJson(res, 400, { ok: false, message: 'Missing required application fields.' });
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
        const hrEmail = process.env.HR_EMAIL || 'mvtechsystems@gmail.com';
        const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
        const roleLabel = roleId ? `${role} (${roleId})` : role;
        const candidate = { name, email, phone, role, roleId, roleLink, message };
        const resumeLink = await uploadResumeToDrive(googleAuth, resumeContent, filename, mimetype);

        await appendCandidateToSheet(googleAuth, candidate, resumeLink);

        if (transport) {
            await transport.sendMail({
                from: fromEmail,
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
                    `Resume Drive Link: ${resumeLink || 'Not stored in Drive'}`,
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
                from: fromEmail,
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
        }

        sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { ok: false, message: 'Unable to submit resume right now. Please email your resume directly to mvtechsystems@gmail.com.' });
    }
};
