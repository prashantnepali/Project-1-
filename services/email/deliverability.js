// Shared Gmail deliverability configuration + helpers.
// Used by email-service (single sends) and campaign-service (queued campaigns).

const { getDb } = require('../../db/connection');

const DEFAULTS = {
  tracking: {
    openTracking: false, // recommended OFF for Gmail lean outreach
    clickTracking: false,
  },
  deliverability: {
    conservativeMode: true,
    stopOnReply: true,
    stopOnBounce: true,
    stopOnUnsubscribe: true,
    dailySendLimit: 40,        // safe default for consumer Gmail
    delayMinSec: 90,           // conservative randomized delay range
    delayMaxSec: 180,
    footerText: '',
  },
};

// Deep-merge stored JSON with defaults. Existing campaigns with '{}' get defaults
// without mutating storage (backward compatible).
function parseTracking(row) {
  let raw = {};
  try { raw = row && row.trackingJson ? JSON.parse(row.trackingJson) : {}; } catch (_) {}
  return {
    openTracking: raw.openTracking !== undefined ? !!raw.openTracking : DEFAULTS.tracking.openTracking,
    clickTracking: raw.clickTracking !== undefined ? !!raw.clickTracking : DEFAULTS.tracking.clickTracking,
  };
}

function parseDeliverability(row) {
  let raw = {};
  try { raw = row && row.deliverabilityJson ? JSON.parse(row.deliverabilityJson) : {}; } catch (_) {}
  const d = DEFAULTS.deliverability;
  return {
    conservativeMode: raw.conservativeMode !== undefined ? !!raw.conservativeMode : d.conservativeMode,
    stopOnReply: raw.stopOnReply !== undefined ? !!raw.stopOnReply : d.stopOnReply,
    stopOnBounce: raw.stopOnBounce !== undefined ? !!raw.stopOnBounce : d.stopOnBounce,
    stopOnUnsubscribe: raw.stopOnUnsubscribe !== undefined ? !!raw.stopOnUnsubscribe : d.stopOnUnsubscribe,
    dailySendLimit: raw.dailySendLimit !== undefined ? parseInt(raw.dailySendLimit, 10) : d.dailySendLimit,
    delayMinSec: raw.delayMinSec !== undefined ? parseInt(raw.delayMinSec, 10) : d.delayMinSec,
    delayMaxSec: raw.delayMaxSec !== undefined ? parseInt(raw.delayMaxSec, 10) : d.delayMaxSec,
    footerText: raw.footerText !== undefined ? String(raw.footerText) : d.footerText,
  };
}

function getCampaignSettings(campaign) {
  return {
    ...parseTracking(campaign),
    ...parseDeliverability(campaign),
  };
}

// Application-level account daily send limit. Order: per-campaign > settings table > default.
function getAccountDailySendLimit(accountId, campaignDeliverability) {
  const fromCampaign = campaignDeliverability && campaignDeliverability.dailySendLimit;
  if (fromCampaign !== undefined && fromCampaign !== null && !isNaN(fromCampaign)) {
    return Math.max(0, fromCampaign);
  }
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('emailDailySendLimit');
    if (row) {
      const v = parseInt(row.value, 10);
      if (!isNaN(v)) return Math.max(0, v);
    }
  } catch (_) {}
  return DEFAULTS.deliverability.dailySendLimit;
}

// Count successful sends from a mailbox for the current calendar day.
function countSendsToday(accountId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM email_sends
    WHERE accountId = ? AND status = 'sent' AND date(sentAt) = date('now')
  `).get(accountId);
  return row ? row.c : 0;
}

// Add/check suppression list (applies across ALL campaigns).
function isSuppressed(email) {
  if (!email) return false;
  return !!getDb().prepare('SELECT email FROM suppressions WHERE email = ?').get(String(email).toLowerCase());
}

function suppress(email, reason, source, campaignId) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  getDb().prepare(`
    INSERT INTO suppressions (email, reason, source, campaignId, createdAt)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, source = excluded.source,
      campaignId = COALESCE(excluded.campaignId, suppressions.campaignId)
  `).run(e, reason || 'unspecified', source || null, campaignId || null);
  return true;
}

module.exports = {
  DEFAULTS,
  parseTracking,
  parseDeliverability,
  getCampaignSettings,
  getAccountDailySendLimit,
  countSendsToday,
  isSuppressed,
  suppress,
};
