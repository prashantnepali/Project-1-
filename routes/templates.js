const { Router } = require('express');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');

const router = Router();

const ALLOWED_FIELDS = ['name', 'subject', 'body', 'category', 'placeholders'];

// ── Static routes (must come before /:id) ──

// List templates
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, limit, offset } = req.query;
    let query = 'SELECT * FROM email_templates WHERE 1=1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }

    query += ' ORDER BY usageCount DESC, updatedAt DESC';
    if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
    if (offset) { query += ' OFFSET ?'; params.push(parseInt(offset)); }

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parameterized routes ──

// Get single template
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const id = genId();
    const { name, subject, body, category, placeholders } = req.body;

    if (!name) return res.status(400).json({ error: 'Template name is required' });

    db.prepare(`
      INSERT INTO email_templates (id, name, subject, body, category, placeholders, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, name, subject || '', body || '', category || 'custom', JSON.stringify(placeholders || []));

    res.status(201).json(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update template
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const fields = [];
    const params = [];

    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(key === 'placeholders' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }

    if (!fields.length) {
      return res.json(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id));
    }

    fields.push("updatedAt = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE email_templates SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Increment usage count (when template is used in a campaign)
router.post('/:id/use', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE email_templates SET usageCount = usageCount + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
