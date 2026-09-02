const { Router } = require('express');
const { getDb } = require('../db/connection');
const deliv = require('../services/email/deliverability');

const router = Router();

// List suppressions
router.get('/', (req, res) => {
  try {
    const { limit = 200, offset = 0 } = req.query;
    const rows = getDb().prepare(`
      SELECT email, reason, source, campaignId, createdAt
      FROM suppressions
      ORDER BY createdAt DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit) || 200, parseInt(offset) || 0);
    const count = getDb().prepare('SELECT COUNT(*) AS c FROM suppressions').get().c;
    res.json({ suppressions: rows, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a suppression (manual or from bounce/unsubscribe)
router.post('/', (req, res) => {
  try {
    const { email, reason, source, campaignId } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    deliv.suppress(email, reason || 'manual', source || 'user', campaignId || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a suppression (allow re-engage)
router.delete('/:email', (req, res) => {
  try {
    getDb().prepare('DELETE FROM suppressions WHERE email = ?').run(String(req.params.email).toLowerCase());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check whether a specific address is suppressed
router.get('/check', (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query param required' });
    res.json({ suppressed: deliv.isSuppressed(email) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
