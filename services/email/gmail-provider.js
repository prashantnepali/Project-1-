const { google } = require('googleapis');
const { getDb } = require('../../db/connection');
const { genId } = require('../helpers');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels'
];

const SAMPARKA_LABEL = 'samparka-sent';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URL || 'http://localhost:3001/auth/google/callback'
  );
}

async function getOrCreateLabel(account) {
  const auth = getAuthForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const labels = await gmail.users.labels.list({ userId: 'me' });
  const existing = labels.data.labels?.find(l => l.name === SAMPARKA_LABEL);
  if (existing) return existing.id;

  const created = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: SAMPARKA_LABEL,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  return created.data.id;
}

function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
}

async function handleCallback(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });

  const db = getDb();
  const email = profile.data.emailAddress;
  const displayName = profile.data.displayName || email.split('@')[0];

  const existing = db.prepare('SELECT id FROM email_accounts WHERE email = ? AND provider = ?').get(email, 'google');

  if (existing) {
    db.prepare(`
      UPDATE email_accounts
      SET accessToken = ?, refreshToken = ?, tokenExpiry = ?, displayName = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date?.toString(), displayName, existing.id);
    return { id: existing.id, email, displayName, status: 'updated' };
  }

  const id = genId();
  db.prepare(`
    INSERT INTO email_accounts (id, provider, email, displayName, accessToken, refreshToken, tokenExpiry, scope, status)
    VALUES (?, 'google', ?, ?, ?, ?, ?, ?, 'active')
  `).run(id, email, displayName, tokens.access_token, tokens.refresh_token, tokens.expiry_date?.toString(), SCOPES.join(' '));

  return { id, email, displayName, status: 'connected' };
}

const _authClients = new Map();

function getAuthForAccount(account) {
  if (_authClients.has(account.id)) return _authClients.get(account.id);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: parseInt(account.tokenExpiry) || null
  });

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      const db = getDb();
      db.prepare(`
        UPDATE email_accounts SET accessToken = ?, tokenExpiry = ?, updatedAt = datetime('now') WHERE id = ?
      `).run(tokens.access_token, tokens.expiry_date?.toString(), account.id);
    }
  });

  _authClients.set(account.id, oauth2Client);
  return oauth2Client;
}

async function sendEmail(account, { to, subject, text, html, inReplyTo, references }) {
  const auth = getAuthForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const parts = [];
  parts.push('MIME-Version: 1.0');
  parts.push(`To: ${to}`);
  parts.push(`From: ${account.displayName} <${account.email}>`);
  parts.push(`Subject: ${subject}`);
  if (inReplyTo) parts.push(`In-Reply-To: ${inReplyTo}`);
  if (references) parts.push(`References: ${references}`);

  if (html) {
    parts.push('Content-Type: text/html; charset="UTF-8"');
    parts.push('');
    parts.push(html);
  } else {
    parts.push('Content-Type: text/plain; charset="UTF-8"');
    parts.push('');
    parts.push(text || '');
  }

  const raw = Buffer.from(parts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const labelId = await getOrCreateLabel(account);

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, labelIds: [labelId] }
  });

  return { messageId: res.data.id, threadId: res.data.threadId };
}

async function listMessages(account, query = 'label:inbox', maxResults = 50, pageToken) {
  const auth = getAuthForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const params = { userId: 'me', q: query, maxResults };
  if (pageToken) params.pageToken = pageToken;

  const res = await gmail.users.messages.list(params);
  return { messages: res.data.messages || [], nextPageToken: res.data.nextPageToken };
}

function toDbDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function getMessage(account, messageId) {
  const auth = getAuthForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const msg = res.data;

  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

  let body = '';
  const parts = msg.payload?.parts || [];
  const target = parts.find(p => p.mimeType === 'text/plain') || parts.find(p => p.mimeType === 'text/html') || msg.payload;

  if (target?.body?.data) {
    body = Buffer.from(target.body.data, 'base64').toString('utf-8');
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: toDbDate(getHeader('Date')) || getHeader('Date'),
    snippet: msg.snippet,
    body,
    labels: msg.labelIds,
    isUnread: msg.labelIds?.includes('UNREAD')
  };
}

module.exports = { getAuthUrl, handleCallback, getAuthForAccount, sendEmail, listMessages, getMessage };
