const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');
const { auth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const userId = genId();
    const teamId = genId();

    db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)').run(userId, email, hashed, name, 'admin');

      db.prepare('INSERT INTO teams (id, name, ownerId) VALUES (?, ?, ?)').run(teamId, name + "'s Team", userId);
      db.prepare('UPDATE users SET teamId = ? WHERE id = ?').run(teamId, userId);
      db.prepare('INSERT INTO team_members (teamId, userId, role) VALUES (?, ?, ?)').run(teamId, userId, 'admin');
    })();

    const token = jwt.sign({ id: userId, email, name, teamId, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: userId, email, name, role: 'admin', teamId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    db.prepare('UPDATE users SET lastLogin = datetime(\'now\') WHERE id = ?').run(user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, teamId: user.teamId, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, teamId, avatar, createdAt, lastLogin FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let team = null;
    if (user.teamId) {
      team = db.prepare('SELECT id, name FROM teams WHERE id = ?').get(user.teamId);
    }

    res.json({ ...user, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/me', auth, (req, res) => {
  try {
    const { name, avatar } = req.body;
    const db = getDb();
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }

    if (updates.length) {
      params.push(req.user.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const user = db.prepare('SELECT id, email, name, role, teamId, avatar FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
