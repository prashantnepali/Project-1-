const { Router } = require('express');
const emailService = require('../services/email/email-service');

const router = Router();

router.post('/send', async (req, res) => {
  try {
    const { accountId, to, subject, text, html, leadId, campaignId, inReplyTo, references } = req.body;
    if (!accountId || !to || !subject) {
      return res.status(400).json({ error: 'accountId, to, and subject are required' });
    }
    const result = await emailService.sendSingle(accountId, { to, subject, text, html, leadId, campaignId, inReplyTo, references });

    // Track activity for all email sends
    const { getDb } = require('../db/connection');
    const { genId } = require('../services/helpers');
    const db = getDb();
    db.prepare(`
      INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
      VALUES (?, ?, ?, 'email_sent', ?, ?, ?)
    `).run(
      genId(), leadId || null, null,
      `Sent email to ${to}: ${subject}`,
      JSON.stringify({ messageId: result.messageId, threadId: result.threadId, campaignId }),
      new Date().toISOString()
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/sends', (req, res) => {
  try {
    const { campaignId, leadId, accountId, limit, offset } = req.query;
    res.json(emailService.getSends({
      campaignId, leadId, accountId,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/replies', (req, res) => {
  try {
    const { accountId, limit, offset } = req.query;
    res.json(emailService.getReplies(accountId, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/replies/sync', async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    const result = await emailService.syncReplies(accountId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications', (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const notifications = emailService.getNotifications({ unreadOnly, limit: parseInt(req.query.limit) || 50 });
    res.json({ notifications, unread: emailService.countUnreadNotifications() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/read', (req, res) => {
  try {
    const { ids } = req.body || {};
    emailService.markNotificationsRead(ids);
    res.json({ success: true, unread: emailService.countUnreadNotifications() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
