const { getDb } = require('../../db/connection');
const { genId } = require('../helpers');
const gmail = require('./gmail-provider');
const smtp = require('./smtp-provider');

function getAccount(id) {
  return getDb().prepare('SELECT * FROM email_accounts WHERE id = ?').get(id);
}

function getAccounts() {
  return getDb().prepare('SELECT id, provider, email, displayName, status, connectedAt, updatedAt FROM email_accounts').all();
}

function deleteAccount(id) {
  return getDb().prepare('DELETE FROM email_accounts WHERE id = ?').run(id);
}

function replacePlaceholders(template, lead, company) {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName || lead.name?.split(' ')[0] || '')
    .replace(/\{\{lastName\}\}/g, lead.lastName || lead.name?.split(' ').slice(1).join(' ') || '')
    .replace(/\{\{company\}\}/g, company?.name || lead.company || '')
    .replace(/\{\{industry\}\}/g, company?.industry || lead.industry || '')
    .replace(/\{\{title\}\}/g, lead.title || '')
    .replace(/\{\{name\}\}/g, lead.name || '');
}

async function sendSingle(accountId, { to, subject, text, html, leadId, campaignId, inReplyTo, references }) {
  const db = getDb();
  const account = getAccount(accountId);
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');

  const id = genId();
  try {
    let result;
    if (account.provider === 'smtp') {
      result = await smtp.sendEmail(account, { to, subject, text, html, inReplyTo, references });
    } else {
      result = await gmail.sendEmail(account, { to, subject, text, html, inReplyTo, references });
    }

    db.prepare(`
      INSERT INTO email_sends (id, campaignId, leadId, accountId, toEmail, subject, body, messageId, threadId, status, sentAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', datetime('now'))
    `).run(id, campaignId || null, leadId || null, accountId, to, subject, html || text || '', result.messageId, result.threadId);

    if (leadId) {
      db.prepare(`UPDATE leads SET lastActivity = datetime('now') WHERE id = ?`).run(leadId);
    }

    return { id, messageId: result.messageId, threadId: result.threadId, status: 'sent' };
  } catch (err) {
    db.prepare(`
      INSERT INTO email_sends (id, campaignId, leadId, accountId, toEmail, subject, body, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(id, campaignId || null, leadId || null, accountId, to, subject, html || text || '', err.message);
    throw err;
  }
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

    let campaignId = null;

    if (full.threadId) {
      const sendMatch = db.prepare('SELECT campaignId FROM email_sends WHERE threadId = ?').get(full.threadId);
      if (sendMatch?.campaignId) {
        campaignId = sendMatch.campaignId;
      }
    }

    db.prepare(`
      INSERT INTO email_replies (id, accountId, leadId, campaignId, messageId, threadId, fromEmail, toEmail, subject, body, snippet, receivedAt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id, accountId, leadMatch?.id || null, campaignId,
      full.id, full.threadId, fromEmail, account.email,
      full.subject, full.body, full.snippet, full.date
    );

    db.prepare(`
      INSERT INTO notifications (id, type, replyId, accountId, leadId, fromEmail, subject, snippet, read, createdAt)
      VALUES (?, 'reply', ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      genId(), id, accountId, leadMatch?.id || null,
      fromEmail, full.subject || null, full.snippet || null
    );

    if (leadMatch?.id) {
      db.prepare(`UPDATE leads SET lastActivity = datetime('now'), status = 'replied' WHERE id = ?`).run(leadMatch.id);

      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'reply_received', ?, ?, datetime('now'))
      `).run(
        genId(), leadMatch.id, null,
        `Reply received from ${fromEmail}: ${full.subject || '(no subject)'}`,
        JSON.stringify({ messageId: full.id, threadId: full.threadId, campaignId })
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

module.exports = { getAccount, getAccounts, deleteAccount, replacePlaceholders, sendSingle, getReplies, syncReplies, getSends, getNotifications, countUnreadNotifications, markNotificationsRead };
