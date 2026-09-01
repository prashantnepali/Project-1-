const { Router } = require('express');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');

const router = Router();

const ALLOWED_FIELDS = ['name', 'value', 'currency', 'stage', 'probability', 'expectedCloseDate', 'notes', 'leadId', 'campaignId'];

// ── Static routes (must come before /:id) ──

// Deal metrics
router.get('/metrics/overview', (req, res) => {
  try {
    const db = getDb();

    const pipeline = db.prepare(`
      SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as totalValue
      FROM deals GROUP BY stage
    `).all();

    const totals = db.prepare(`
      SELECT
        COUNT(*) as totalDeals,
        COALESCE(SUM(CASE WHEN stage = 'won' THEN value ELSE 0 END), 0) as wonValue,
        COALESCE(SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN value ELSE 0 END), 0) as pipelineValue,
        COUNT(CASE WHEN stage = 'won' THEN 1 END) as wonCount,
        COUNT(CASE WHEN stage = 'lost' THEN 1 END) as lostCount,
        COUNT(CASE WHEN stage NOT IN ('won', 'lost') THEN 1 END) as activeCount,
        COALESCE(AVG(CASE WHEN stage = 'won' THEN value END), 0) as avgDealSize
      FROM deals
    `).get();

    const conversionRate = totals.totalDeals > 0
      ? ((totals.wonCount / totals.totalDeals) * 100).toFixed(1)
      : '0.0';

    const recentDeals = db.prepare(`
      SELECT d.*, l.name as leadName FROM deals d
      LEFT JOIN leads l ON d.leadId = l.id
      ORDER BY d.updatedAt DESC LIMIT 5
    `).all();

    res.json({ ...totals, pipeline, conversionRate, recentDeals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List deals
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { stage, leadId, limit, offset } = req.query;
    let query = 'SELECT d.*, l.name as leadName, l.company as leadCompany FROM deals d LEFT JOIN leads l ON d.leadId = l.id WHERE 1=1';
    const params = [];

    if (stage) { query += ' AND d.stage = ?'; params.push(stage); }
    if (leadId) { query += ' AND d.leadId = ?'; params.push(leadId); }

    query += ' ORDER BY d.updatedAt DESC';
    if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
    if (offset) { query += ' OFFSET ?'; params.push(parseInt(offset)); }

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parameterized routes ──

// Get single deal
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const deal = db.prepare(`
      SELECT d.*, l.name as leadName, l.company as leadCompany
      FROM deals d LEFT JOIN leads l ON d.leadId = l.id WHERE d.id = ?
    `).get(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create deal
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const id = genId();
    const { name, value, currency, stage, probability, expectedCloseDate, notes, leadId, campaignId } = req.body;

    if (!name) return res.status(400).json({ error: 'Deal name is required' });

    db.prepare(`
      INSERT INTO deals (id, name, value, currency, stage, probability, expectedCloseDate, notes, leadId, campaignId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id, name, value || 0, currency || 'USD', stage || 'lead',
      probability || 10, expectedCloseDate || null, notes || '',
      leadId || null, campaignId || null
    );

    if (leadId) {
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'deal_created', ?, ?, ?)
      `).run(genId(), leadId, null, `Deal created: ${name}`, JSON.stringify({ dealId: id, value: value || 0 }), new Date().toISOString());
    }

    res.status(201).json(db.prepare('SELECT * FROM deals WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update deal
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Deal not found' });

    const fields = [];
    const params = [];

    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (req.body.stage && req.body.stage !== existing.stage) {
      if (req.body.stage === 'won') {
        fields.push('actualCloseDate = ?', 'probability = 100');
        params.push(new Date().toISOString(), null); // null for second placeholder of probability=100
      } else if (req.body.stage === 'lost') {
        fields.push('actualCloseDate = ?', 'probability = 0');
        params.push(new Date().toISOString(), null);
      }
    }

    if (!fields.length) {
      return res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
    }

    fields.push("updatedAt = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE deals SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    if (req.body.stage && req.body.stage !== existing.stage && existing.leadId) {
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'deal_stage_changed', ?, ?, ?)
      `).run(genId(), existing.leadId, null, `Deal "${existing.name}" moved to ${req.body.stage}`, JSON.stringify({ dealId: req.params.id, from: existing.stage, to: req.body.stage }), new Date().toISOString());
    }

    res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete deal
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
