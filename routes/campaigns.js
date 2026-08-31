const { Router } = require('express');
const campaignService = require('../services/campaign/campaign-service');
const emailService = require('../services/email/email-service');
const { getDb } = require('../db/connection');

const router = Router();

// ── Static routes (must come before /:id) ──

router.get('/metrics', (req, res) => {
  try {
    res.json(campaignService.getAllMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics/overview', (req, res) => {
  try {
    const db = getDb();

    const totals = db.prepare(`
      SELECT
        COUNT(*) as totalSends,
        SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) as totalOpened,
        SUM(CASE WHEN clickedAt IS NOT NULL THEN 1 ELSE 0 END) as totalClicked,
        SUM(CASE WHEN bouncedAt IS NOT NULL THEN 1 ELSE 0 END) as totalBounced,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as totalFailed
      FROM email_sends
    `).get();

    const replyCount = db.prepare('SELECT COUNT(*) as c FROM email_replies').get().c;
    const positiveReplies = db.prepare("SELECT COUNT(*) as c FROM email_replies WHERE sentiment = 'positive'").get().c;

    const perCampaign = db.prepare(`
      SELECT
        c.id, c.name, c.status, c.sent, c.opened, c.clicked, c.replied, c.bounced, c.createdAt,
        CASE WHEN c.sent > 0 THEN ROUND(c.opened * 100.0 / c.sent, 1) ELSE 0 END as openRate,
        CASE WHEN c.sent > 0 THEN ROUND(c.clicked * 100.0 / c.sent, 1) ELSE 0 END as clickRate
      FROM campaigns c
      WHERE c.sent > 0
      ORDER BY c.createdAt DESC
    `).all();

    const dailySends = db.prepare(`
      SELECT date(sentAt) as day, COUNT(*) as sent
      FROM email_sends WHERE sentAt IS NOT NULL
      GROUP BY day ORDER BY day DESC LIMIT 30
    `).all();

    const dailyOpens = db.prepare(`
      SELECT date(openedAt) as day, COUNT(*) as opened
      FROM email_sends WHERE openedAt IS NOT NULL
      GROUP BY day ORDER BY day DESC LIMIT 30
    `).all();

    const dailyClicks = db.prepare(`
      SELECT date(clickedAt) as day, COUNT(*) as clicked
      FROM email_sends WHERE clickedAt IS NOT NULL
      GROUP BY day ORDER BY day DESC LIMIT 30
    `).all();

    res.json({
      ...totals,
      totalReplies: replyCount,
      positiveReplies,
      overallOpenRate: totals.totalSends ? Math.min((totals.totalOpened / totals.totalSends) * 100, 100).toFixed(1) : '0.0',
      overallClickRate: totals.totalSends ? Math.min((totals.totalClicked / totals.totalSends) * 100, 100).toFixed(1) : '0.0',
      overallReplyRate: totals.totalSends ? Math.min((replyCount / totals.totalSends) * 100, 100).toFixed(1) : '0.0',
      perCampaign,
      dailySends: dailySends.reverse(),
      dailyOpens: dailyOpens.reverse(),
      dailyClicks: dailyClicks.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    res.json(campaignService.getCampaigns({
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const campaign = campaignService.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Parameterized routes ──

router.get('/:id', (req, res) => {
  try {
    const campaign = campaignService.getCampaignMetrics(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const campaign = campaignService.updateCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    campaignService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/leads', (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!leadIds?.length) return res.status(400).json({ error: 'leadIds required' });
    const added = campaignService.assignLeads(req.params.id, leadIds);
    res.json({ added });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/leads', (req, res) => {
  try {
    res.json(campaignService.getCampaignLeads(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/leads/:leadId', (req, res) => {
  try {
    campaignService.removeLead(req.params.id, req.params.leadId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const result = await campaignService.sendCampaign(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Email tracking analytics — per-campaign breakdown
router.get('/:id/tracking', (req, res) => {
  try {
    const db = getDb();
    const campaignId = req.params.id;
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const sends = db.prepare('SELECT COUNT(*) as c FROM email_sends WHERE campaignId = ?').get(campaignId).c;
    const opened = db.prepare('SELECT COUNT(*) as c FROM email_sends WHERE campaignId = ? AND openedAt IS NOT NULL').get(campaignId).c;
    const clicked = db.prepare('SELECT COUNT(*) as c FROM email_sends WHERE campaignId = ? AND clickedAt IS NOT NULL').get(campaignId).c;
    const bounced = db.prepare('SELECT COUNT(*) as c FROM email_sends WHERE campaignId = ? AND bouncedAt IS NOT NULL').get(campaignId).c;
    const replied = db.prepare('SELECT COUNT(*) as c FROM email_replies WHERE campaignId = ?').get(campaignId).c;
    const failed = db.prepare("SELECT COUNT(*) as c FROM email_sends WHERE campaignId = ? AND status = 'failed'").get(campaignId).c;

    const timeline = db.prepare(`
      SELECT date(sentAt) as day, COUNT(*) as sent
      FROM email_sends WHERE campaignId = ? AND sentAt IS NOT NULL
      GROUP BY day ORDER BY day
    `).all(campaignId);

    const openTimeline = db.prepare(`
      SELECT date(openedAt) as day, COUNT(*) as opened
      FROM email_sends WHERE campaignId = ? AND openedAt IS NOT NULL
      GROUP BY day ORDER BY day
    `).all(campaignId);

    const clickTimeline = db.prepare(`
      SELECT date(clickedAt) as day, COUNT(*) as clicked
      FROM email_sends WHERE campaignId = ? AND clickedAt IS NOT NULL
      GROUP BY day ORDER BY day
    `).all(campaignId);

    res.json({
      sends,
      opened,
      clicked,
      bounced,
      replied,
      failed,
      openRate: sends ? ((opened / sends) * 100).toFixed(1) : '0.0',
      clickRate: sends ? ((clicked / sends) * 100).toFixed(1) : '0.0',
      replyRate: sends ? ((replied / sends) * 100).toFixed(1) : '0.0',
      bounceRate: sends ? ((bounced / sends) * 100).toFixed(1) : '0.0',
      timeline,
      openTimeline,
      clickTimeline,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
