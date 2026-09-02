const { getDb } = require('../db/connection');

function getActivities(filters = {}) {
  const db = getDb();
  let query = `SELECT * FROM activities WHERE 1=1`;
  const params = [];

  if (filters.leadId) {
    query += ` AND leadId = ?`;
    params.push(filters.leadId);
  }
  if (filters.companyId) {
    query += ` AND companyId = ?`;
    params.push(filters.companyId);
  }
  if (filters.type) {
    query += ` AND type = ?`;
    params.push(filters.type);
  }

  query += ` ORDER BY timestamp DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }

  const rows = db.prepare(query).all(...params);

  // Enrich reply_received activities with the recipient's reply text.
  // Old activities don't store the snippet in metadata, so look it up from
  // the email_replies table by messageId/threadId/leadId.
  for (const row of rows) {
    if (row.type !== 'reply_received') continue;

    let meta = {};
    try { meta = (typeof row.metadata === 'string') ? JSON.parse(row.metadata || '{}') : (row.metadata || {}); } catch {}

    let replyText = meta.snippet || null;
    if (!replyText) {
      // Fall back to the stored reply for this activity's lead (most recent reply).
      const reply = db.prepare(`
        SELECT snippet, body FROM email_replies WHERE leadId = ? ORDER BY COALESCE(receivedAt, createdAt) DESC LIMIT 1
      `).get(row.leadId);
      if (reply) replyText = reply.snippet || reply.body || null;
    }
    meta.snippet = replyText;
    row.metadata = JSON.stringify(meta);
  }

  return rows;
}

module.exports = { getActivities };
