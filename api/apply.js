const fs = require('fs/promises');
const formidable = require('formidable');
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

    const transport = createTransport();
    if (!transport) {
        sendJson(res, 503, { ok: false, message: 'Resume upload is not configured yet.' });
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

        sendJson(res, 200, { ok: true });
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { ok: false, message: 'Unable to submit resume right now.' });
    }
};
