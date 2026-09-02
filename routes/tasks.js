const { Router } = require('express');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');

const router = Router();

const TASK_TYPES = ['follow_up', 'call', 'meeting', 'email', 'note'];
const ALLOWED_FIELDS = ['type', 'title', 'description', 'dueDate', 'priority', 'leadId', 'campaignId', 'dealId'];

// ── Static routes (must come before /:id) ──

// Tasks overview stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN completedAt IS NULL AND dueDate < datetime('now') THEN 1 END) as overdue,
        COUNT(CASE WHEN completedAt IS NULL AND dueDate >= datetime('now') THEN 1 END) as pending,
        COUNT(CASE WHEN completedAt IS NOT NULL THEN 1 END) as completed
      FROM tasks
    `).get();

    const todayTasks = db.prepare(`
      SELECT t.*, l.name as leadName FROM tasks t
      LEFT JOIN leads l ON t.leadId = l.id
      WHERE t.completedAt IS NULL AND t.dueDate <= datetime('now', '+1 day')
      ORDER BY t.dueDate ASC LIMIT 10
    `).all();

    res.json({ ...stats, todayTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List tasks
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { leadId, campaignId, dealId, type, completed, overdue, limit, offset } = req.query;

    let query = `
      SELECT t.*, l.name as leadName, l.company as leadCompany
      FROM tasks t LEFT JOIN leads l ON t.leadId = l.id WHERE 1=1
    `;
    const params = [];

    if (leadId) { query += ' AND t.leadId = ?'; params.push(leadId); }
    if (campaignId) { query += ' AND t.campaignId = ?'; params.push(campaignId); }
    if (dealId) { query += ' AND t.dealId = ?'; params.push(dealId); }
    if (type) { query += ' AND t.type = ?'; params.push(type); }
    if (completed === 'true') { query += ' AND t.completedAt IS NOT NULL'; }
    if (completed === 'false') { query += ' AND t.completedAt IS NULL'; }
    if (overdue === 'true') {
      query += " AND t.completedAt IS NULL AND t.dueDate < datetime('now')";
    }

    query += ' ORDER BY t.completedAt IS NULL DESC, t.dueDate ASC';
    if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
    if (offset) { query += ' OFFSET ?'; params.push(parseInt(offset)); }

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parameterized routes ──

// Get single task
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*, l.name as leadName FROM tasks t
      LEFT JOIN leads l ON t.leadId = l.id WHERE t.id = ?
    `).get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const id = genId();
    const { type, title, description, dueDate, priority, leadId, campaignId, dealId } = req.body;

    if (!title) return res.status(400).json({ error: 'Task title is required' });

    db.prepare(`
      INSERT INTO tasks (id, type, title, description, dueDate, priority, leadId, campaignId, dealId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id, type || 'follow_up', title, description || '',
      dueDate || null, priority || 'medium',
      leadId || null, campaignId || null, dealId || null
    );

    if (leadId) {
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'task_created', ?, ?, ?)
      `).run(genId(), leadId, null, `Task created: ${title}`, JSON.stringify({ taskId: id, type: type || 'follow_up', dueDate }), new Date().toISOString());
    }

    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update task
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const fields = [];
    const params = [];

    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    // Complete task
    if (req.body.completed && !existing.completedAt) {
      fields.push('completedAt = ?');
      params.push(new Date().toISOString());
    }
    // Uncomplete task
    if (req.body.completed === false && existing.completedAt) {
      fields.push('completedAt = NULL');
    }

    if (!fields.length) {
      return res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
    }

    fields.push("updatedAt = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    // Log completion
    if (req.body.completed && !existing.completedAt && existing.leadId) {
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'task_completed', ?, ?, ?)
      `).run(genId(), existing.leadId, null, `Task completed: ${existing.title}`, JSON.stringify({ taskId: req.params.id }), new Date().toISOString());
    }

    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
