const express = require('express');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const db = getDb();
    const teamId = genId();

    db.transaction(() => {
      db.prepare('INSERT INTO teams (id, name, ownerId) VALUES (?, ?, ?)').run(teamId, name, req.user.id);
      db.prepare('INSERT INTO team_members (teamId, userId, role) VALUES (?, ?, ?)').run(teamId, req.user.id, 'admin');
      db.prepare('UPDATE users SET teamId = ?, role = ? WHERE id = ?').run(teamId, 'admin', req.user.id);
    })();

    res.json({ id: teamId, name, ownerId: req.user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const teams = db.prepare(`
      SELECT t.id, t.name, t.ownerId, t.createdAt,
        (SELECT COUNT(*) FROM team_members WHERE teamId = t.id) as memberCount
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.teamId
      WHERE tm.userId = ?
    `).all(req.user.id);

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM team_members WHERE teamId = ? AND userId = ?').get(req.params.id, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this team' });
    }

    const team = db.prepare('SELECT id, name, ownerId, createdAt FROM teams WHERE id = ?').get(req.params.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const members = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.avatar, tm.joinedAt
      FROM users u
      INNER JOIN team_members tm ON u.id = tm.userId
      WHERE tm.teamId = ?
    `).all(req.params.id);

    res.json({ ...team, members, yourRole: membership.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/invite', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM team_members WHERE teamId = ? AND userId = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only team admins can invite members' });
    }

    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found. They must register first.' });
    }

    const existing = db.prepare('SELECT * FROM team_members WHERE teamId = ? AND userId = ?').get(req.params.id, user.id);
    if (existing) {
      return res.status(409).json({ error: 'User is already a team member' });
    }

    db.prepare('INSERT INTO team_members (teamId, userId, role) VALUES (?, ?, ?)').run(req.params.id, user.id, role || 'member');
    db.prepare('UPDATE users SET teamId = ? WHERE id = ?').run(req.params.id, user.id);

    res.json({ success: true, user: { id: user.id, name: user.name, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/members/:userId', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM team_members WHERE teamId = ? AND userId = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only team admins can change roles' });
    }

    const { role } = req.body;
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin, member, or viewer' });
    }

    db.prepare('UPDATE team_members SET role = ? WHERE teamId = ? AND userId = ?').run(role, req.params.id, req.params.userId);
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.userId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM team_members WHERE teamId = ? AND userId = ?').get(req.params.id, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only team admins can remove members' });
    }

    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself from the team' });
    }

    db.prepare('DELETE FROM team_members WHERE teamId = ? AND userId = ?').run(req.params.id, req.params.userId);

    const otherTeam = db.prepare('SELECT teamId FROM team_members WHERE userId = ? LIMIT 1').get(req.params.userId);
    db.prepare('UPDATE users SET teamId = ? WHERE id = ?').run(otherTeam ? otherTeam.teamId : null, req.params.userId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
