const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM user_settings WHERE userId = ?`).all(req.user.id);
    const settings = {};
    for (const row of rows) {
      try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(`INSERT OR REPLACE INTO user_settings (userId, key, value) VALUES (?, ?, ?)`);
    const updateMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        stmt.run(req.user.id, key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    updateMany(Object.entries(req.body));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
