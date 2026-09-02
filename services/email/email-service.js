const { getDb } = require('../../db/connection');
const { genId } = require('../helpers');
const gmail = require('./gmail-provider');
const smtp = require('./smtp-provider');

// Convert a plain-text body into safe HTML so newlines render correctly in
// HTML emails. Bodies that already contain HTML tags are passed through untouched.
function toHtmlBody(body) {
  if (!body) return body;
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return String(body)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');
}

function getAccount(id) {
  return getDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
}

function getAccounts() {
  return getDb().prepare('SELECT id, provider, email, displayName, status, connectedAt, updatedAt FROM email_accounts').all();
}

function deleteAccount(id) {
  return getDb().prepare('DELETE FROM email_accounts WHERE id = ?').run(id);
}

let _settingsCache = null;
let _settingsCacheAt = 0;
function getSettings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < 30000) return _settingsCache;
  const settings = {};
  try {
    const rows = getDb().prepare('SELECT key, value FROM settings').all();
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
  } catch {}
  _settingsCache = settings;
  _settingsCacheAt = now;
  return settings;
}

function invalidateSettingsCache() {
  _settingsCache = null;
  _settingsCacheAt = 0;
}

function replacePlaceholders(template, lead, company) {
  if (!template) return template;
  const firstName = lead.firstName || lead.name?.split(' ')[0] || '';
  const lastName = lead.lastName || lead.name?.split(' ').slice(1).join(' ') || '';
  const companyName = company?.name || lead.company || '';

  const settings = getSettings();
  const senderName = settings.profileName || 'Prashant';
  const contactPhone = settings.contactPhone || '';

  return template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{lastName\}\}/g, lastName)
    .replace(/\{\{company\}\}/g, companyName)
    .replace(/\{\{industry\}\}/g, company?.industry || lead.industry || '')
    .replace(/\{\{title\}\}/g, lead.title || '')
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{phone_number\}\}/g, contactPhone);
}

function injectTracking(html, sendId, { openTracking = true, clickTracking = true } = {}) {
  if (!html) return html;

  let trackedHtml = html;

  // Validate public BASE_URL before applying any tracking.
  // Production outgoing mail must never embed localhost/private/dev URLs.
  const base = validateBaseUrl();
  if (!base.isPublic) {
    // No tracking can be applied safely: return the original body untouched.
    // (Tracking endpoints still work when a real public BASE_URL is configured.)
    return { html: trackedHtml, trackingApplied: false, reason: base.reason };
  }

  const BASE_URL = base.url;

  // Open tracking pixel — only when Open Tracking is ON
  if (openTracking) {
    const pixelUrl = `${BASE_URL}/api/tracking/open/${sendId}`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
    if (trackedHtml.toLowerCase().includes('</body>')) {
      trackedHtml = trackedHtml.replace(/<\/body>/i, `${pixel}</body>`);
    } else {
      trackedHtml += pixel;
    }
  }

  // Click tracking — only when Click Tracking is ON
  if (clickTracking) {
    trackedHtml = trackedHtml.replace(
      /<a\s+[^>]*href=["']((https?:\/\/)[^"']+)["'][^>]*>/gi,
      (match, url) => {
        // Don't track anchor links or tracking pixel URLs
        if (url.includes('/api/tracking/') || url.startsWith('#')) return match;
        const trackedUrl = `${BASE_URL}/api/tracking/click/${sendId}?url=${encodeURIComponent(url)}`;
        return match.replace(url, trackedUrl);
      }
    );
  }

  return { html: trackedHtml, trackingApplied: true, reason: null };
}

// Validate that BASE_URL is a configured public HTTPS URL (not localhost/private).
function validateBaseUrl() {
  let BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
  try {
    const u = new URL(BASE_URL);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && u.hostname === 'localhost')) {
      return { isPublic: false, reason: `BASE_URL must be a public HTTPS URL (got ${BASE_URL})` };
    }
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || host.endsWith('.localhost')) {
      return { isPublic: false, reason: `Tracking disabled: BASE_URL resolves to local/private host ${host}` };
    }
    return { isPublic: true, url: BASE_URL.replace(/\/$/, '') };
  } catch (_) {
    return { isPublic: false, reason: `BASE_URL is not a valid URL: ${BASE_URL}` };
  }
}


async function sendSingle(accountId, { to, subject, text, html, leadId, campaignId, inReplyTo, references, campaign }) {
  const db = getDb();
  const account = getAccount(accountId);
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');

  // Resolve deliverability settings from the campaign (falls back to defaults).
  const settings = campaign
    ? dynamicRequire('./deliverability').getCampaignSettings(campaign)
    : dynamicRequire('./deliverability').DEFAULTS;

  const id = genId();

  // Replace placeholders in subject and body when we have a lead.
  if (leadId) {
    const lead = db.prepare(
      `SELECT l.*, c.name AS companyName, c.industry AS companyIndustry
       FROM leads l LEFT JOIN companies c ON l.companyId = c.id
       WHERE l.id = ?`
    ).get(leadId);
    if (lead) {
      const company = { name: lead.companyName, industry: lead.companyIndustry };
      subject = replacePlaceholders(subject, lead, company);
      html = replacePlaceholders(html, lead, company);
      text = replacePlaceholders(text, lead, company);
    }
  }

  // Suppression check applies across ALL campaigns.
  if (dynamicRequire('./deliverability').isSuppressed(to)) {
    const skipMsg = `Suppressed address, skipped before send`;
    db.prepare(`
      INSERT INTO email_sends (id, campaignId, leadId, accountId, toEmail, subject, body, status, error, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'blocked', ?, datetime('now'))
    `).run(id, campaignId || null, leadId || null, accountId, to, subject, html || text || '', skipMsg);
    return { id, status: 'blocked', reason: skipMsg };
  }

  // Ensure plain-text bodies get converted to HTML so line breaks are preserved.
  let outHtml = toHtmlBody(html);

  // Optional plain-footer opt-out line (never forced).
  const footerText = settings.footerText;
  if (footerText && outHtml) {
    const footerHtml = outHtml.toLowerCase().includes('</body>')
      ? `</body>`
      : '';
    if (footerHtml) outHtml = outHtml.replace('</body>', `${escapeFooter(footerText)}</body>`);
    else outHtml += `<div style="margin-top:24px;font-size:12px;color:#777777">${escapeFooter(footerText)}</div>`;
  }

  try {
    // Tracking controlled by campaign toggles.
    const tracked = injectTracking(outHtml, id, { openTracking: settings.openTracking, clickTracking: settings.clickTracking });

    const finalHtml = (tracked && tracked.html) ? tracked.html : outHtml;
    const trackingApplied = tracked && tracked.trackingApplied === true;

    let result;
    if (account.provider === 'smtp') {
      result = await smtp.sendEmail(account, { to, subject, text, html: finalHtml, inReplyTo, references });
    } else {
      result = await gmail.sendEmail(account, { to, subject, text, html: finalHtml, inReplyTo, references });
    }

    db.prepare(`
      INSERT INTO email_sends (id, campaignId, leadId, accountId, toEmail, subject, body, messageId, threadId, status, sentAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)
    `).run(id, campaignId || null, leadId || null, accountId, to, subject, finalHtml, result.messageId, result.threadId, new Date().toISOString());

    if (leadId) {
      db.prepare(`UPDATE leads SET lastActivity = datetime('now') WHERE id = ?`).run(leadId);
    }

    return { id, messageId: result.messageId, threadId: result.threadId, status: 'sent', trackingApplied };
  } catch (err) {
    db.prepare(`
      INSERT INTO email_sends (id, campaignId, leadId, accountId, toEmail, subject, body, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(id, campaignId || null, leadId || null, accountId, to, subject, html || text || '', err.message);
    throw err;
  }
}

// Small helper to avoid requiring deliverability.js at module top (keeps deps lazy).
let _deliv;
function dynamicRequire(name) {
  if (name === './deliverability') {
    if (!_deliv) _deliv = require('./deliverability');
    return _deliv;
  }
  return require(name);
}

function escapeFooter(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getReplies(accountId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM email_replies';
  const params = [];

  if (accountId) {
    query += ' WHERE accountId = ?';
    params.push(accountId);
  }

  query += ' ORDER BY COALESCE(receivedAt, createdAt) DESC, createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

async function syncReplies(accountId) {
  const db = getDb();
  const account = getAccount(accountId);
  if (!account) throw new Error('Account not found');
  if (account.provider !== 'google') throw new Error('Reply sync is only available for Gmail accounts. SMTP accounts cannot sync inbound replies.');

  const lastReply = db.prepare(
    'SELECT receivedAt FROM email_replies WHERE accountId = ? ORDER BY receivedAt DESC LIMIT 1'
  ).get(accountId);

  let query = '-from:me -label:samparka-sent';
  if (lastReply?.receivedAt) {
    const afterDate = new Date(lastReply.receivedAt);
    const dateStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
    query += ` after:${dateStr}`;
  }

  const { messages } = await gmail.listMessages(account, query, 100);

  let synced = 0;
  for (const msg of messages) {
    const existing = db.prepare('SELECT id FROM email_replies WHERE messageId = ?').get(msg.id);
    if (existing) continue;

    const full = await gmail.getMessage(account, msg.id);
    const id = genId();

    const fromMatch = full.from?.match(/<(.+?)>/);
    const fromEmail = fromMatch ? fromMatch[1] : full.from;

    const leadMatch = db.prepare('SELECT id FROM leads WHERE email = ?').get(fromEmail);

    let campaignId = null;    if (full.threadId) {
      const sendMatch = db.prepare('SELECT campaignId FROM email_sends WHERE threadId = ?').get(full.threadId);
      if (sendMatch?.campaignId) {
        campaignId = sendMatch.campaignId;
      }
    }

    // Auto-detect sentiment from reply text
    const replyText = full.body || full.snippet || '';
    const sentiment = detectSentiment(replyText);

    // Explicit opt-out / no-contact => global suppression (applies to all campaigns).
    if (isUnsubscribe(replyText, full.subject)) {
      dynamicRequire('./deliverability').suppress(fromEmail, 'unsubscribe', 'email_reply', campaignId);
    }

    db.prepare(
      `INSERT INTO email_replies (id, accountId, leadId, campaignId, messageId, threadId, fromEmail, toEmail, subject, body, snippet, sentiment, receivedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id, accountId, leadMatch?.id || null, campaignId,
      full.id, full.threadId, fromEmail, account.email,
      full.subject, full.body, full.snippet, sentiment, full.date
    );

    db.prepare(`
      INSERT INTO notifications (id, type, replyId, accountId, leadId, fromEmail, subject, snippet, read, createdAt)
      VALUES (?, 'reply', ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      genId(), id, accountId, leadMatch?.id || null,
      fromEmail, full.subject || null, full.snippet || null
    );

    if (leadMatch?.id) {
      const now = new Date().toISOString();
      const PIPELINE_ORDER = ['new', 'contacted', 'replied', 'qualified', 'proposal', 'demo', 'negotiation', 'won', 'lost', 'customer'];
      const currentLead = db.prepare('SELECT status FROM leads WHERE id = ?').get(leadMatch.id);
      const currentIdx = PIPELINE_ORDER.indexOf(currentLead?.status || 'new');
      const repliedIdx = PIPELINE_ORDER.indexOf('replied');
      if (currentIdx < repliedIdx || currentLead?.status === 'new' || currentLead?.status === 'contacted') {
        db.prepare(`UPDATE leads SET lastActivity = ?, status = 'replied' WHERE id = ?`).run(now, leadMatch.id);
      } else {
        db.prepare(`UPDATE leads SET lastActivity = ? WHERE id = ?`).run(now, leadMatch.id);
      }

      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'reply_received', ?, ?, ?)
      `).run(
        genId(), leadMatch.id, null,
        `Reply received from ${fromEmail}: ${full.subject || '(no subject)'}`,
        JSON.stringify({ messageId: full.id, threadId: full.threadId, campaignId, snippet: full.snippet || null, body: full.body || null }),
        now
      );
    }

    if (campaignId) {
      db.prepare(`
        UPDATE campaign_leads
        SET status = 'replied', repliedAt = datetime('now')
        WHERE campaignId = ? AND leadId = ? AND status IN ('pending', 'sent')
      `).run(campaignId, leadMatch?.id);

      db.prepare('UPDATE campaigns SET replied = replied + 1 WHERE id = ?').run(campaignId);
    }

    synced++;
  }

  return { synced, total: messages.length };
}

function getSends({ campaignId, leadId, accountId, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  let conditions = [];
  let params = [];

  if (campaignId) { conditions.push('campaignId = ?'); params.push(campaignId); }
  if (leadId) { conditions.push('leadId = ?'); params.push(leadId); }
  if (accountId) { conditions.push('accountId = ?'); params.push(accountId); }

  let query = 'SELECT * FROM email_sends';
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY COALESCE(sentAt, createdAt) DESC, createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

function getNotifications({ unreadOnly = false, limit = 50 } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM notifications';
  if (unreadOnly) query += ' WHERE read = 0';
  query += ' ORDER BY createdAt DESC LIMIT ?';
  return db.prepare(query).all(limit);
}

function countUnreadNotifications() {
  return getDb().prepare('SELECT COUNT(*) c FROM notifications WHERE read = 0').get().c;
}

function markNotificationsRead(ids = []) {
  const db = getDb();
  if (Array.isArray(ids) && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`UPDATE notifications SET read = 1 WHERE id IN (${placeholders})`).run(...ids).changes;
  }
  return db.prepare('UPDATE notifications SET read = 1').run().changes;
}

function detectSentiment(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  const positive = [
    'interested', 'sounds great', 'love it', 'perfect', 'yes', 'sure', 'absolutely',
    "let's schedule", 'tell me more', 'looking forward', 'excited', 'happy to',
    'thank you', 'great idea', 'count me in', 'i agree', 'wonderful', 'awesome',
    'that works', 'good to hear', 'appreciate', 'congratulations', 'well done',
    'thanks for reaching out', 'thanks for contacting', 'thank you for reaching out',
    'reaching out to me', 'glad you reached', 'happy to hear', 'hello', 'hi there',
    'sounds good', 'great', 'nice to hear', 'let\'s connect', 'let us know more',
  ];

  const negative = [
    'not interested', 'unsubscribe', 'remove me', 'no thanks', 'no thank you',
    'do not contact', 'don\'t contact', 'leave me alone', 'spam', 'go away',
    'opt out', 'take me off', 'not a good time', 'not now',
    'complaint', 'report abuse', 'stop contacting', 'stop emailing',
  ];

  let posScore = 0;
  let negScore = 0;

  for (const word of positive) {
    if (lower.includes(word)) posScore++;
  }
  for (const word of negative) {
    if (lower.includes(word)) negScore++;
  }

  if (negScore > 0 && negScore >= posScore) return 'negative';
  if (posScore > 0) return 'positive';
  return 'neutral';
}

const UNSUB_PHRASES = [
  'unsubscribe', 'remove me', 'take me off', 'do not contact', 'do not email', "don't contact",
  'no contact', 'opt out', 'opt-out', 'no more emails', 'stop contacting', 'stop emailing',
  'not interested', 'no thanks', 'please remove', 'remove from your list', 'spam',
];

function isUnsubscribe(...texts) {
  const joined = texts.filter(Boolean).join(' ').toLowerCase();
  return UNSUB_PHRASES.some(p => joined.includes(p));
}

// Record a confirmed hard bounce: mark the send bounced, increment campaign
// counters, and globally suppress the address so no further campaign sends it.
function markBounced(sendId) {
  const db = getDb();
  const send = db.prepare('SELECT * FROM email_sends WHERE id = ?').get(sendId);
  if (!send) throw new Error('Email send not found');

  db.prepare("UPDATE email_sends SET status = 'bounced', bouncedAt = COALESCE(bouncedAt, datetime('now')) WHERE id = ?").run(sendId);

  if (send.campaignId) {
    db.prepare('UPDATE campaigns SET bounced = bounced + 1 WHERE id = ? AND status != \'completed\'').run(send.campaignId);
    if (send.leadId) {
      db.prepare("UPDATE campaign_leads SET status = 'bounced' WHERE campaignId = ? AND leadId = ?").run(send.campaignId, send.leadId);
    }
  }

  if (send.toEmail) {
    dynamicRequire('./deliverability').suppress(send.toEmail, 'hard bounce', 'email_bounce', send.campaignId || null);
  }
  return { id: sendId, status: 'bounced' };
}

module.exports = {
  getAccount, getAccounts, deleteAccount, replacePlaceholders, sendSingle, getReplies, syncReplies,
  getSends, getNotifications, countUnreadNotifications, markNotificationsRead,
  injectTracking, validateBaseUrl, markBounced, isUnsubscribe, toHtmlBody, invalidateSettingsCache,
};
