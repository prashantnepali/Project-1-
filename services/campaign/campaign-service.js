const { getDb } = require('../../db/connection');
const { genId } = require('../helpers');
const emailService = require('../email/email-service');
const deliv = require('../email/deliverability');

function createCampaign({ name, accountId, subject, body, targetFilter, scheduledAt, tracking, deliverability }) {
  const id = genId();
  const db = getDb();

  db.prepare(`
    INSERT INTO campaigns (id, name, accountId, subject, body, targetFilter, status, scheduledAt, trackingJson, deliverabilityJson, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    id, name, accountId || null, subject, body || '', JSON.stringify(targetFilter || {}),
    scheduledAt || null,
    JSON.stringify(tracking || {}),
    JSON.stringify(deliverability || {})
  );

  return getCampaign(id);
}

function getCampaign(id) {
  const row = getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  if (!row) return null;
  const settings = deliv.getCampaignSettings(row);
  return {
    ...row,
    tracking: { openTracking: settings.openTracking, clickTracking: settings.clickTracking },
    deliverability: {
      conservativeMode: settings.conservativeMode,
      stopOnReply: settings.stopOnReply,
      stopOnBounce: settings.stopOnBounce,
      stopOnUnsubscribe: settings.stopOnUnsubscribe,
      dailySendLimit: settings.dailySendLimit,
      delayMinSec: settings.delayMinSec,
      delayMaxSec: settings.delayMaxSec,
      footerText: settings.footerText,
    },
  };
}

function getCampaigns({ status, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM campaigns';
  const params = [];

  if (status) { query += ' WHERE status = ?'; params.push(status); }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params);
  return rows.map(r => {
    const settings = deliv.getCampaignSettings(r);
    return {
      ...r,
      tracking: { openTracking: settings.openTracking, clickTracking: settings.clickTracking },
      deliverability: {
        conservativeMode: settings.conservativeMode,
        stopOnReply: settings.stopOnReply,
        stopOnBounce: settings.stopOnBounce,
        stopOnUnsubscribe: settings.stopOnUnsubscribe,
        dailySendLimit: settings.dailySendLimit,
        delayMinSec: settings.delayMinSec,
        delayMaxSec: settings.delayMaxSec,
        footerText: settings.footerText,
      },
    };
  });
}

function updateCampaign(id, updates) {
  const db = getDb();
  const fields = [];
  const params = [];

  // Deliverability / tracking settings are stored as JSON columns.
  if (updates.tracking !== undefined) {
    fields.push('trackingJson = ?');
    params.push(JSON.stringify(updates.tracking));
  }
  if (updates.deliverability !== undefined) {
    fields.push('deliverabilityJson = ?');
    params.push(JSON.stringify(updates.deliverability));
  }

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

// Enqueue all currently-pending campaign leads into the idempotent queue.
// Re-running is safe (UNIQUE(campaignId, leadId, stepOrder) prevents duplicates).
function enqueueCampaign(campaignId) {
  const db = getDb();
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.accountId) throw new Error('No sender account assigned to campaign');

  const pendingLeads = db.prepare(`
    SELECT cl.*, l.name, l.email, l.firstName, l.lastName, l.company, c.name as companyName, c.industry
    FROM campaign_leads cl
    JOIN leads l ON cl.leadId = l.id
    LEFT JOIN companies c ON l.companyId = c.id
    WHERE cl.campaignId = ? AND cl.status = 'pending'
  `).all(campaignId);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO campaign_queue (id, campaignId, leadId, accountId, stepOrder, status, createdAt)
    VALUES (?, ?, ?, ?, 1, 'queued', datetime('now'))
  `);

  const tx = db.transaction((leads) => {
    let enqueued = 0;
    for (const row of leads) {
      if (!row.email) continue;
      const r = insert.run(genId(), campaignId, row.leadId, campaign.accountId);
      if (r.changes) enqueued++;
    }
    return { enqueued, total: leads.filter(l => l.email).length };
  });

  const result = tx(pendingLeads);
  // Count how many are still queued (not already sent/processed).
  const queuedCount = db.prepare("SELECT COUNT(*) AS c FROM campaign_queue WHERE campaignId = ? AND status = 'queued'").get(campaignId).c;
  return { ...result, queued: queuedCount };
}

// Process the queue sequentially. Apply randomized delay between real sends
// (only when delayMin > 0, for testability). Respect daily cap, suppression,
// and stop-on-reply/bounce/unsubscribe. Remaining rows stay 'queued'.
async function processCampaignQueue(campaignId, { delayMinSec, delayMaxSec } = {}) {
  const db = getDb();
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (!campaign.accountId) throw new Error('No sender account assigned to campaign');

  const settings = deliv.getCampaignSettings(campaign);

  const minDelay = delayMinSec !== undefined ? delayMinSec : settings.delayMinSec;
  const maxDelay = delayMaxSec !== undefined ? delayMaxSec : settings.delayMaxSec;
  const dailyLimit = deliv.getAccountDailySendLimit(campaign.accountId, settings);

  const account = emailService.getAccount(campaign.accountId);
  if (!account) throw new Error('Sender account not found');

  // Ensure campaign is marked active.
  if (campaign.status !== 'active') {
    db.prepare("UPDATE campaigns SET status = 'active', startedAt = COALESCE(startedAt, datetime('now')) WHERE id = ?").run(campaignId);
  }

  const stats = {
    sent: 0, failed: 0, skipped: 0, blocked: 0, queuedRemaining: 0, dailyCapReached: false,
  };

  while (true) {
    // Atomically claim the next queued row (idempotency: only 'queued' rows are processed).
    const claimed = db.prepare(`
      SELECT q.* FROM campaign_queue q
      WHERE q.campaignId = ? AND q.status = 'queued'
      ORDER BY q.createdAt ASC, q.rowid ASC
      LIMIT 1
    `).get(campaignId);

    if (!claimed) break;

    // Mark processing before the (potentially slow) provider call. On restart,
    // 'processing' rows are recovered back to 'queued' (see recoverStaleQueue).
    db.prepare("UPDATE campaign_queue SET status = 'processing', attemptCount = attemptCount + 1 WHERE id = ?").run(claimed.id);

    const lead = db.prepare(`
      SELECT l.*, c.name as companyName, c.industry
      FROM leads l LEFT JOIN companies c ON l.companyId = c.id
      WHERE l.id = ?
    `).get(claimed.leadId);

    if (!lead || !lead.email) {
      db.prepare("UPDATE campaign_queue SET status = 'failed', error = ?, processedAt = datetime('now') WHERE id = ?").run('No email on lead', claimed.id);
      db.prepare("UPDATE campaign_leads SET status = 'failed' WHERE campaignId = ? AND leadId = ?").run(campaignId, claimed.leadId);
      stats.failed++;
      continue;
    }

    // Stop on reply: if recipient already replied and stopOnReply is on, skip future steps.
    if (settings.stopOnReply) {
      const cl = db.prepare("SELECT status FROM campaign_leads WHERE campaignId = ? AND leadId = ?").get(campaignId, claimed.leadId);
      if (cl && cl.status === 'replied') {
        db.prepare("UPDATE campaign_queue SET status = 'skipped', error = ?, processedAt = datetime('now') WHERE id = ?").run('Recipient replied; sequence stopped', claimed.id);
        db.prepare("UPDATE campaign_leads SET status = 'replied' WHERE campaignId = ? AND leadId = ?").run(campaignId, claimed.leadId);
        _logActivity(lead.id, 'sequence_stopped', `Sequence stopped for ${lead.email}: replied before follow-up`, { campaignId, message: 'reply' });
        stats.skipped++;
        continue;
      }
    }

    // Suppression check (global, across campaigns).
    if (deliv.isSuppressed(lead.email)) {
      db.prepare("UPDATE campaign_queue SET status = 'blocked', error = ?, processedAt = datetime('now') WHERE id = ?").run('Suppressed recipient, skipped before send', claimed.id);
      db.prepare("UPDATE campaign_leads SET status = 'skipped' WHERE campaignId = ? AND leadId = ?").run(campaignId, claimed.leadId);
      stats.blocked++;
      continue;
    }

    // Daily cap: count successful sends today for this account.
    const sentToday = deliv.countSendsToday(campaign.accountId);
    if (dailyLimit > 0 && sentToday >= dailyLimit) {
      // Do not send more today; leave the rest queued. Keep this row queued.
      db.prepare("UPDATE campaign_queue SET status = 'queued' WHERE id = ?").run(claimed.id);
      stats.dailyCapReached = true;
      break;
    }

    try {
      const result = await emailService.sendSingle(campaign.accountId, {
        to: lead.email, subject: campaign.subject, html: campaign.body || '', leadId: lead.id, campaignId, campaign,
      });

      db.prepare("UPDATE campaign_queue SET status = 'sent', processedAt = datetime('now') WHERE id = ?").run(claimed.id);

      if (result.status === 'blocked') {
        db.prepare("UPDATE campaign_leads SET status = 'skipped' WHERE campaignId = ? AND leadId = ?").run(campaignId, claimed.leadId);
        stats.blocked++;
      } else {
        db.prepare(`
          UPDATE campaign_leads SET status = 'sent', sentAt = datetime('now'), messageId = ?
          WHERE campaignId = ? AND leadId = ?
        `).run(result.messageId || claimed.id, campaignId, claimed.leadId);
        db.prepare('UPDATE campaigns SET sent = sent + 1 WHERE id = ?').run(campaignId);
        stats.sent++;
      }
    } catch (err) {
      db.prepare("UPDATE campaign_queue SET status = 'failed', error = ?, processedAt = datetime('now') WHERE id = ?").run(err.message, claimed.id);
      db.prepare("UPDATE campaign_leads SET status = 'failed' WHERE campaignId = ? AND leadId = ?").run(campaignId, claimed.leadId);
      stats.failed++;
    }

    // Randomized conservative delay *between real sends* (rate control only).
    // Skipped/blocked/failed rows do not incur a delay.
    if (stats.sent > 0) {
      const moreQueued = db.prepare("SELECT COUNT(*) AS c FROM campaign_queue WHERE campaignId = ? AND status = 'queued'").get(campaignId).c;
      if (moreQueued > 0 && maxDelay > 0) {
        const delayMs = randomDelay(minDelay, maxDelay) * 1000;
        if (delayMs > 0) await sleep(delayMs);
      }
    }
  }

  const queuedRemaining = db.prepare("SELECT COUNT(*) AS c FROM campaign_queue WHERE campaignId = ? AND status = 'queued'").get(campaignId).c;
  stats.queuedRemaining = queuedRemaining;

  // If queue is fully drained, mark campaign complete (unless paused).
  if (queuedRemaining === 0) {
    if (stats.failed > 0 && stats.sent === 0) {
      db.prepare("UPDATE campaigns SET status = 'failed', completedAt = datetime('now') WHERE id = ?").run(campaignId);
    } else {
      db.prepare("UPDATE campaigns SET status = 'completed', completedAt = datetime('now') WHERE id = ?").run(campaignId);
    }
  }

  return stats;
}

function randomDelay(minSec, maxSec) {
  minSec = Math.max(0, parseInt(minSec, 10) || 0);
  maxSec = Math.max(0, parseInt(maxSec, 10) || 0);
  if (maxSec <= 0) return 0;
  if (minSec > maxSec) minSec = maxSec;
  return Math.round(minSec + Math.random() * (maxSec - minSec));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Recover rows stuck in 'processing' after a crash/restart so they are not lost.
function recoverStaleQueue() {
  const db = getDb();
  db.prepare("UPDATE campaign_queue SET status = 'queued' WHERE status = 'processing'").run();
}

function getCampaignQueue(campaignId) {
  return getDb().prepare(`
    SELECT q.*, l.name, l.email
    FROM campaign_queue q
    LEFT JOIN leads l ON q.leadId = l.id
    WHERE q.campaignId = ?
    ORDER BY q.createdAt ASC
  `).all(campaignId);
}

async function sendCampaign(campaignId) {
  const enqueued = enqueueCampaign(campaignId);
  const stats = await processCampaignQueue(campaignId);
  return {
    enqueued: enqueued.enqueued,
    ...stats,
    total: getDb().prepare("SELECT COUNT(*) AS c FROM campaign_queue WHERE campaignId = ?").get(campaignId).c,
  };
}

// Render the final message for a single recipient (personalization preview).
function previewForLead(campaign, lead) {
  const db = getDb();
  const fullLead = lead.companyName === undefined
    ? db.prepare(`
        SELECT l.*, c.name as companyName, c.industry
        FROM leads l LEFT JOIN companies c ON l.companyId = c.id
        WHERE l.id = ?
      `).get(lead.id || lead.leadId)
    : lead;

  const subject = emailService.replacePlaceholders(campaign.subject, fullLead, { name: fullLead.companyName, industry: fullLead.industry });
  const body = emailService.toHtmlBody(emailService.replacePlaceholders(campaign.body || '', fullLead, { name: fullLead.companyName, industry: fullLead.industry }));
  const account = campaign.accountId ? emailService.getAccount(campaign.accountId) : null;

  const remaining = (str) => {
    const m = String(str || '').match(/\{\{([^}]+)\}\}/g);
    return m ? [...new Set(m)] : [];
  };

  return {
    from: account ? `${account.displayName || account.email} <${account.email}>` : null,
    to: fullLead.email,
    subject,
    body,
    unresolved: [...new Set([...remaining(subject), ...remaining(body)])],
    tracking: campaign.tracking,
  };
}

function getMetricRow(campaignId) {
  const db = getDb();
  const c = getCampaign(campaignId);
  if (!c) return null;

  const replyCount = db.prepare('SELECT COUNT(*) as count FROM email_replies WHERE campaignId = ?').get(campaignId).count;

  return {
    ...c,
    replyCount,
    openTrackingOn: c.tracking.openTracking,
    clickTrackingOn: c.tracking.clickTracking,
    openRate: c.sent && c.tracking.openTracking ? ((c.opened / c.sent) * 100).toFixed(1) : null,
    clickRate: c.sent && c.tracking.clickTracking ? ((c.clicked / c.sent) * 100).toFixed(1) : null,
    replyRate: c.sent ? ((replyCount / c.sent) * 100).toFixed(1) : 0,
    bounceRate: c.sent ? ((c.bounced / c.sent) * 100).toFixed(1) : 0,
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

function _logActivity(leadId, type, description, metadata) {
  const { getDb: dbx } = require('../../db/connection');
  const { genId: gid } = require('../helpers');
  try {
    dbx().prepare(`
      INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(gid(), leadId || null, null, type, description, JSON.stringify(metadata || {}));
  } catch (_) {}
}

module.exports = {
  createCampaign, getCampaign, getCampaigns, updateCampaign, deleteCampaign,
  assignLeads, getCampaignLeads, sendCampaign, getCampaignMetrics: getMetricRow, getAllMetrics,
  enqueueCampaign, processCampaignQueue, getCampaignQueue, recoverStaleQueue, previewForLead,
};
