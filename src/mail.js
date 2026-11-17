// Email notifications. If SMTP isn't configured, messages are printed to the server log instead.
let transport = null;
if (process.env.SMTP_HOST) {
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}
const FROM = process.env.MAIL_FROM || 'ESU Management <no-reply@esumllc.com>';
const OFFICE = process.env.OFFICE_EMAIL || '';
const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function send(to, subject, text) {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return;
  if (!transport) {
    console.log(`[mail disabled] to=${recipients.join(', ')} subject="${subject}"\n${text}\n`);
    return;
  }
  try { await transport.sendMail({ from: FROM, to: recipients.join(', '), subject, text }); }
  catch (e) { console.error('Email failed:', e.message); }
}

module.exports = { send, OFFICE, SITE_URL };
