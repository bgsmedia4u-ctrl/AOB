import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// If a refresh token is already stored, set it so Gmail is always ready
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

const gmailApi = google.gmail({ version: 'v1', auth: oauth2Client });

// Create a nodemailer transporter if user/pass are provided in env
const smtpTransporter = (process.env.GMAIL_USER && process.env.GMAIL_PASS)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    })
  : null;

// Unified email sender
export async function sendEmail({ to, subject, body, rawEmail }) {
  if (smtpTransporter) {
    await smtpTransporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: body
    });
  } else {
    await gmailApi.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawEmail }
    });
  }
}

