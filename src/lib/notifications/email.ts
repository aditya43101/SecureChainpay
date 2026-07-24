import nodemailer from 'nodemailer';

// Brevo SMTP Settings
const smtpHost = 'smtp-relay.brevo.com';
const smtpPort = 587;
const smtpUser = process.env.BREVO_FROM_EMAIL || 'dummy'; // Brevo uses your login email for SMTP
const smtpPass = process.env.BREVO_API_KEY || 'dummy'; // This should be the SMTP key from Brevo

const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@securechain.com';
const fromName = process.env.BREVO_FROM_NAME || 'SecureChain Pay';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false, // true for 465, false for other ports
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  if (!process.env.BREVO_API_KEY) {
    console.warn('BREVO_API_KEY is missing. Skipping real email dispatch.');
    return null;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`Brevo Email sent via Nodemailer to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Brevo Nodemailer Error:', error);
    throw error;
  }
}
