const { getDb } = require('../../db/connection');
const { genId } = require('../helpers');
const emailService = require('../email/email-service');

function createCampaign({ name, accountId, subject, body, targetFilter, scheduledAt }) {
  const id = genId();
  const db = getDb();

  db.prepare(`
    INSERT INTO campaigns (id, name, accountId, subject, body, targetFilter, status, scheduledAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
  `).run(id, name, accountId || null, subject, body || '', JSON.stringify(targetFilter || {}), scheduledAt || null);

  return getCampaign(id);
}

function getCampaign(id) {
  return getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
}

function getCampaigns({ status, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM campaigns';
  const params = [];

  if (status) { query += ' WHERE status = ?'; params.push(status); }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

function updateCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const params = [];

  const allowed = ['name', 'accountId', 'subject', 'body', 'targetFilter', 'status', 'scheduledAt'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(key === 'targetFilter' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }

  if (!fields.length) return getCampaign(id);

  fields.push("updatedAt = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getCampaign(id);
}

function deleteCampaign(id) {
  return getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}

function assignLeads(campaignId, leadIds) {
  const db = getDb();
  const insert = db.prepare('INSERT OR IGNORE INTO campaign_leads (campaignId, leadId, status) VALUES (?, ?, ?)');

  const tx = db.transaction((ids) => {
    let added = 0;
    for (const leadId of ids) {
      const result = insert.run(campaignId, leadId, 'pending');
      if (result.changes) added++;
    }
    return added;
  });

  return tx(leadIds);
}

function removeLead(campaignId, leadId) {
  return getDb().prepare('DELETE FROM campaign_leads WHERE campaignId = ? AND leadId = ?').run(campaignId, leadId);
}

function getCampaignLeads(campaignId) {
  return getDb().prepare(`
    SELECT cl.*, l.name, l.email, l.company, l.firstName, l.lastName
    FROM campaign_leads cl
    JOIN leads l ON cl.leadId = l.id
    WHERE cl.campaignId = ?
    ORDER BY cl.sentAt DESC
  `).all(campaignId);
}

async function sendCampaign(campaignId) {
  const db = getDb();
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.accountId) throw new Error('No sender account assigned to campaign');

  const account = emailService.getAccount(campaign.accountId);
  if (!account) throw new Error('Sender account not found');

  db.prepare("UPDATE campaigns SET status = 'active', startedAt = datetime('now') WHERE id = ?").run(campaignId);

  const pendingLeads = db.prepare(`
    SELECT cl.*, l.name, l.email, l.firstName, l.lastName, l.company, c.name as companyName, c.industry
    FROM campaign_leads cl
    JOIN leads l ON cl.leadId = l.id
    LEFT JOIN companies c ON l.companyId = c.id
    WHERE cl.campaignId = ? AND cl.status = 'pending'
  `).all(campaignId);

  let sent = 0, failed = 0;

  for (const lead of pendingLeads) {
    if (!lead.email) {
      db.prepare("UPDATE campaign_leads SET status = 'failed' WHERE campaignId = ? AND leadId = ?").run(campaignId, lead.leadId);
      failed++;
      continue;
    }

    const subject = emailService.replacePlaceholders(campaign.subject, lead, { name: lead.companyName, industry: lead.industry });
    const body = emailService.replacePlaceholders(campaign.body || '', lead, { name: lead.companyName, industry: lead.industry });

    try {
      const result = await emailService.sendSingle(campaign.accountId, {
        to: lead.email, subject, html: body, leadId: lead.leadId, campaignId
      });

      db.prepare(`
        UPDATE campaign_leads SET status = 'sent', sentAt = datetime('now'), messageId = ?
        WHERE campaignId = ? AND leadId = ?
      `).run(result.messageId, campaignId, lead.leadId);

      db.prepare('UPDATE campaigns SET sent = sent + 1, delivered = delivered + 1 WHERE id = ?').run(campaignId);
      sent++;
    } catch (err) {
      db.prepare("UPDATE campaign_leads SET status = 'failed' WHERE campaignId = ? AND leadId = ?").run(campaignId, lead.leadId);
      failed++;
    }
  }

  db.prepare("UPDATE campaigns SET status = 'completed', completedAt = datetime('now') WHERE id = ?").run(campaignId);

  return { sent, failed, total: pendingLeads.length };
}

function getCampaignMetrics(campaignId) {
  const db = getDb();
  const c = getCampaign(campaignId);
  if (!c) return null;

  const replyCount = db.prepare('SELECT COUNT(*) as count FROM email_replies WHERE campaignId = ?').get(campaignId).count;

  return {
    ...c,
    replyCount,
    openRate: c.sent ? ((c.opened / c.sent) * 100).toFixed(1) : 0,
    replyRate: c.sent ? ((replyCount / c.sent) * 100).toFixed(1) : 0,
    bounceRate: c.sent ? ((c.bounced / c.sent) * 100).toFixed(1) : 0
  };
}

function getAllMetrics() {
  const db = getDb();
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
      COALESCE(SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END), 0) as paused,
      COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as draft,
      COALESCE(SUM(sent), 0) as totalSent,
      COALESCE(SUM(opened), 0) as totalOpened,
      COALESCE(SUM(clicked), 0) as totalClicked,
      COALESCE(SUM(replied), 0) as totalReplied,
      COALESCE(SUM(bounced), 0) as totalBounced
    FROM campaigns
  `).get();

  const replyCount = db.prepare('SELECT COUNT(*) as count FROM email_replies WHERE campaignId IS NOT NULL').get().count;
  const positiveCount = db.prepare("SELECT COUNT(*) as count FROM email_replies WHERE sentiment = 'positive' AND campaignId IS NOT NULL").get().count;

  return {
    ...totals,
    totalReplied: replyCount,
    positiveReplies: positiveCount,
    openRate: totals.totalSent ? ((totals.totalOpened / totals.totalSent) * 100).toFixed(1) : 0,
    replyRate: totals.totalSent ? ((replyCount / totals.totalSent) * 100).toFixed(1) : 0
  };
}

module.exports = {
  createCampaign, getCampaign, getCampaigns, updateCampaign, deleteCampaign,
  assignLeads, getCampaignLeads, sendCampaign, getCampaignMetrics, getAllMetrics
};
