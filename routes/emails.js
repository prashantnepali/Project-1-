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

module.exports = router;
