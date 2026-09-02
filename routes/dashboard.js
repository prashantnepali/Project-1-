const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

router.get('/overview', (req, res) => {
  try {
    const db = getDb();

    // ── Metric cards ──
    const leads = db.prepare(`
      SELECT
        COUNT(*) as totalLeads,
        COUNT(CASE WHEN createdAt >= datetime('now', '-7 days') THEN 1 END) as newThisWeek
      FROM leads
    `).get();

    const campaigns = db.prepare(`
      SELECT
        COUNT(DISTINCT campaigns.id) as total,
        COUNT(DISTINCT CASE WHEN campaigns.status = 'active' THEN campaigns.id END) as active,
        COALESCE(SUM(CASE WHEN date(email_sends.sentAt) = date('now') THEN 1 END), 0) as sentToday
      FROM campaigns
      LEFT JOIN email_sends ON campaigns.id = email_sends.campaignId
    `).get();

    const replies = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive,
        COUNT(CASE WHEN processedAt IS NULL THEN 1 END) as needResponse
      FROM email_replies
    `).get();

    const deals = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN stage NOT IN ('won', 'lost') THEN 1 END) as open,
        COALESCE(SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN value ELSE 0 END), 0) as pipelineValue
      FROM deals
    `).get();

    const tasks = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN completedAt IS NULL AND dueDate < datetime('now') THEN 1 END) as overdue,
        COUNT(CASE WHEN completedAt IS NULL AND date(dueDate) = date('now') THEN 1 END) as dueToday
      FROM tasks
    `).get();

    // ── Needs Attention items ──
    const needsAttention = [];

    const repliesNeed = db.prepare(`
      SELECT COUNT(*) as c FROM email_replies WHERE processedAt IS NULL
    `).get().c;
    if (repliesNeed > 0) {
      needsAttention.push({ type: 'reply', severity: 'red', label: `${repliesNeed} repl${repliesNeed === 1 ? 'y' : 'ies'} need response`, nav: 'replies' });
    }

    const tasksNeed = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE completedAt IS NULL AND dueDate < datetime('now')`).get().c;
    if (tasksNeed > 0) {
      needsAttention.push({ type: 'task', severity: 'red', label: `${tasksNeed} task${tasksNeed === 1 ? '' : 's'} overdue`, nav: 'tasks' });
    }

    const engagedLeads = db.prepare(`
      SELECT l.id, l.name, COUNT(*) as signals
      FROM leads l
      LEFT JOIN email_sends es ON es.leadId = l.id AND es.openedAt IS NOT NULL
      LEFT JOIN email_replies er ON er.leadId = l.id AND er.sentiment = 'positive'
      GROUP BY l.id
      HAVING signals >= 3
      ORDER BY signals DESC
      LIMIT 5
    `).all();
    if (engagedLeads.length > 0) {
      needsAttention.push({ type: 'engaged', severity: 'hot', label: `${engagedLeads.length} highly engaged lead${engagedLeads.length === 1 ? '' : 's'}`, nav: 'leads', leadId: engagedLeads[0].id });
    }

    const proposalFollowUp = db.prepare(`
      SELECT COUNT(*) as c FROM leads WHERE status = 'proposal'
    `).get().c;
    const proposalDeals = db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'proposal'`).get().c;
    if (proposalFollowUp + proposalDeals > 0) {
      needsAttention.push({ type: 'proposal', severity: 'amber', label: `${proposalFollowUp + proposalDeals} proposal${(proposalFollowUp + proposalDeals) === 1 ? '' : 's'} need${(proposalFollowUp + proposalDeals) === 1 ? 's' : ''} follow-up`, nav: 'deals' });
    }

    // ── Pipeline (deals) per stage ──
    const pipelineStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const pipeline = db.prepare(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value FROM deals GROUP BY stage
    `).all();
    const pipelineByStage = {};
    pipelineStages.forEach(s => pipelineByStage[s] = { count: 0, value: 0 });
    pipeline.forEach(p => { if (pipelineByStage[p.stage]) pipelineByStage[p.stage] = { count: p.count, value: p.value }; });

    // ── Campaign performance ──
    const campaignPerf = db.prepare(`
      SELECT
        COUNT(*) as sent,
        COALESCE(SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END), 0) as opened,
        COALESCE(SUM(CASE WHEN clickedAt IS NOT NULL THEN 1 ELSE 0 END), 0) as clicked,
        COALESCE(SUM(CASE WHEN bouncedAt IS NOT NULL THEN 1 ELSE 0 END), 0) as bounced
      FROM email_sends
    `).get();
    const repliedCount = db.prepare('SELECT COUNT(*) as c FROM email_replies').get().c;

    const bestCampaign = db.prepare(`
      SELECT c.name, c.sent, c.replied, c.opened FROM campaigns c
      WHERE c.sent > 0
      ORDER BY (c.replied * 1.0 / c.sent) DESC LIMIT 1
    `).get();

    res.json({
      metrics: {
        leads: { total: leads.totalLeads, newThisWeek: leads.newThisWeek },
        campaigns: { total: campaigns.total, active: campaigns.active, sentToday: campaigns.sentToday },
        replies: { total: replies.total, positive: replies.positive, needResponse: replies.needResponse },
        deals: { total: deals.total, open: deals.open, pipelineValue: deals.pipelineValue },
        tasks: { total: tasks.total, overdue: tasks.overdue, dueToday: tasks.dueToday },
      },
      needsAttention,
      pipeline: pipelineByStage,
      campaignPerf: { ...campaignPerf, replied: repliedCount },
      bestCampaign,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
