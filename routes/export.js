const { Router } = require('express');
const { getDb } = require('../db/connection');

const router = Router();

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function objectRows(headers, objects) {
  return [
    headers,
    ...objects.map(o => headers.map(h => csvEscape(o[h]))),
  ];
}

function sendCsv(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + rows.map(r => r.join(',')).join('\n') + '\n');
}

function sendError(res, err) {
  res.status(500).json({ error: err.message });
}

router.get('/leads', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM leads ORDER BY createdAt DESC').all();
    const headers = ['id', 'name', 'email', 'phone', 'company', 'title', 'industry', 'location', 'source', 'status', 'priority', 'score', 'tags', 'notes', 'createdAt', 'lastActivity'];
    sendCsv(res, 'samparka-leads.csv', objectRows(headers, rows));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/deals', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT d.*, l.name as leadName, l.company as leadCompany
      FROM deals d LEFT JOIN leads l ON d.leadId = l.id
      ORDER BY d.updatedAt DESC
    `).all();
    const headers = ['id', 'name', 'leadName', 'leadCompany', 'value', 'currency', 'stage', 'probability', 'expectedCloseDate', 'actualCloseDate', 'notes', 'createdAt', 'updatedAt'];
    sendCsv(res, 'samparka-deals.csv', objectRows(headers, rows));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/tasks', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT t.*, l.name as leadName, l.company as leadCompany
      FROM tasks t LEFT JOIN leads l ON t.leadId = l.id
      ORDER BY t.dueDate ASC
    `).all();
    const headers = ['id', 'title', 'type', 'priority', 'status', 'dueDate', 'completedAt', 'leadName', 'leadCompany', 'description', 'createdAt', 'updatedAt'];
    const normalized = rows.map(t => ({ ...t, status: t.completedAt ? 'completed' : 'pending' }));
    sendCsv(res, 'samparka-tasks.csv', objectRows(headers, normalized));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/campaigns', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, name, status, sent, delivered, opened, clicked, replied, bounced, scheduledAt, startedAt, completedAt, createdAt
      FROM campaigns ORDER BY createdAt DESC
    `).all();
    const normalized = rows.map(c => ({
      ...c,
      openRate: c.sent ? ((c.opened / c.sent) * 100).toFixed(1) : '0.0',
      clickRate: c.sent ? ((c.clicked / c.sent) * 100).toFixed(1) : '0.0',
      replyRate: c.sent ? ((c.replied / c.sent) * 100).toFixed(1) : '0.0',
      bounceRate: c.sent ? ((c.bounced / c.sent) * 100).toFixed(1) : '0.0',
    }));
    const headers = ['id', 'name', 'status', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'openRate', 'clickRate', 'replyRate', 'bounceRate', 'scheduledAt', 'startedAt', 'completedAt', 'createdAt'];
    sendCsv(res, 'samparka-campaigns.csv', objectRows(headers, normalized));
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/leads/:id/emails', (req, res) => {
  try {
    const db = getDb();
    const leadId = req.params.id;

    const lead = db.prepare('SELECT name, company FROM leads WHERE id = ?').get(leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const sends = db.prepare(`
      SELECT subject, toEmail, status, sentAt, deliveredAt, openedAt, clickedAt, bouncedAt, error, campaignId
      FROM email_sends WHERE leadId = ?
      ORDER BY createdAt DESC
    `).all(leadId);

    const replies = db.prepare(`
      SELECT fromEmail, toEmail, subject, body, sentiment, receivedAt
      FROM email_replies WHERE leadId = ?
      ORDER BY receivedAt DESC
    `).all(leadId);

    const campaignNames = db.prepare('SELECT id, name FROM campaigns').all();
    const nameMap = {};
    campaignNames.forEach(c => { nameMap[c.id] = c.name; });
    const campaignName = (id) => (id && nameMap[id]) || '';

    const sendRows = sends.map(s => ({
      ...s,
      campaign: campaignName(s.campaignId),
      status: s.status || 'pending',
    }));

    const sendHeaders = ['subject', 'toEmail', 'campaign', 'status', 'sentAt', 'deliveredAt', 'openedAt', 'clickedAt', 'bouncedAt', 'error'];

    const rows = [
      [`LEAD EMAIL LOG — ${lead.name}${lead.company ? ' ('.concat(lead.company, ')') : ''}`],
      [],
      ['EMAIL SENDS'],
      ...objectRows(sendHeaders, sendRows),
      [],
      ['REPLIES'],
      ...objectRows(['fromEmail', 'toEmail', 'subject', 'body', 'sentiment', 'receivedAt'], replies),
    ];

    sendCsv(res, 'samparka-lead-emails.csv', rows);
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/analytics', (req, res) => {
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
    const totalSends = totals.totalSends || 0;

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
      FROM email_sends WHERE sentAt IS NOT NULL GROUP BY day ORDER BY day
    `).all();
    const dailyOpens = db.prepare(`
      SELECT date(openedAt) as day, COUNT(*) as opened
      FROM email_sends WHERE openedAt IS NOT NULL GROUP BY day ORDER BY day
    `).all();
    const dailyClicks = db.prepare(`
      SELECT date(clickedAt) as day, COUNT(*) as clicked
      FROM email_sends WHERE clickedAt IS NOT NULL GROUP BY day ORDER BY day
    `).all();

    const dayMap = {};
    dailySends.forEach(r => { dayMap[r.day] = dayMap[r.day] || { day: r.day, sent: 0, opened: 0, clicked: 0 }; dayMap[r.day].sent = r.sent; });
    dailyOpens.forEach(r => { dayMap[r.day] = dayMap[r.day] || { day: r.day, sent: 0, opened: 0, clicked: 0 }; dayMap[r.day].opened = r.opened; });
    dailyClicks.forEach(r => { dayMap[r.day] = dayMap[r.day] || { day: r.day, sent: 0, opened: 0, clicked: 0 }; dayMap[r.day].clicked = r.clicked; });
    const daily = Object.values(dayMap).sort((a, b) => a.day < b.day ? -1 : 1);

    const norm = (v) => (v !== null && v !== undefined ? v : 0);
    const overviewHeaders = ['metric', 'value'];
    const overview = objectRows(overviewHeaders, [
      { metric: 'Total Sends', value: norm(totals.totalSends) },
      { metric: 'Total Opened', value: norm(totals.totalOpened) },
      { metric: 'Total Clicked', value: norm(totals.totalClicked) },
      { metric: 'Total Bounced', value: norm(totals.totalBounced) },
      { metric: 'Total Failed', value: norm(totals.totalFailed) },
      { metric: 'Total Replies', value: replyCount },
      { metric: 'Positive Replies', value: positiveReplies },
      { metric: 'Open Rate', value: totalSends ? Math.min((norm(totals.totalOpened) / totalSends) * 100, 100).toFixed(1) + '%' : '0.0%' },
      { metric: 'Click Rate', value: totalSends ? Math.min((norm(totals.totalClicked) / totalSends) * 100, 100).toFixed(1) + '%' : '0.0%' },
      { metric: 'Reply Rate', value: totalSends ? Math.min((replyCount / totalSends) * 100, 100).toFixed(1) + '%' : '0.0%' },
    ]);

    const campaignHeaders = ['id', 'name', 'status', 'sent', 'opened', 'clicked', 'replied', 'bounced', 'openRate', 'clickRate'];
    const campaigns = objectRows(campaignHeaders, perCampaign);

    const dailyHeaders = ['day', 'sent', 'opened', 'clicked'];
    const dailyRows = objectRows(dailyHeaders, daily);

    const rows = [
      ['OVERALL METRICS'],
      ...overview,
      [],
      ['PER-CAMPAIGN BREAKDOWN'],
      ...campaigns,
      [],
      ['DAILY ACTIVITY'],
      ...dailyRows,
    ];

    sendCsv(res, 'samparka-analytics.csv', rows);
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;