const express = require('express');
const router = express.Router();
const leadService = require('../services/lead-service');
const { getDb } = require('../db/connection');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  try {
    const { search, status, priority, industry, source, limit, offset } = req.query;
    const leads = leadService.getLeads({
      search, status, priority, industry, source,
      userId: req.user.id,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q || !q.trim()) {
      return res.json([]);
    }

    const db = getDb();
    const maxResults = limit ? parseInt(limit) : 20;

    const ftsQuery = q.split(/\s+/).filter(Boolean).map(t => `"${t.replace(/"/g, '""')}*`).join(' ');

    const rows = db.prepare(`
      SELECT l.*, l.rowid as rowid,
        snippet(leads_fts, 0, '<mark>', '</mark>', '...', 32) as nameMatch,
        snippet(leads_fts, 1, '<mark>', '</mark>', '...', 32) as companyMatch
      FROM leads_fts
      INNER JOIN leads l ON l.rowid = leads_fts.rowid
      WHERE leads_fts MATCH ? AND l.userId = ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, req.user.id, maxResults);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/metrics', (req, res) => {
  try {
    const metrics = leadService.getMetrics(req.user.id);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const lead = leadService.getLeadById(req.params.id, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const lead = leadService.addManualLead({ ...req.body, userId: req.user.id });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const lead = leadService.updateLead(req.params.id, req.body, req.user.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    leadService.deleteLead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
