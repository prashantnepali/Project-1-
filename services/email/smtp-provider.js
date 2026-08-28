const nodemailer = require('nodemailer');

function createTransporter(account) {
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure === 'true',
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass
    }
  });
}

async function sendEmail(account, { to, subject, text, html, inReplyTo, references }) {
  const transporter = createTransporter(account);

  const mailOptions = {
    from: `${account.displayName} <${account.email}>`,
    to,
    subject,
    text,
    html,
    inReplyTo,
    references
  };

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId, threadId: null };
}

module.exports = { sendEmail };