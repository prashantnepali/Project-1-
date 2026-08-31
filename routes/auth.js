const { Router } = require('express');
const gmailProvider = require('../services/email/gmail-provider');
const emailService = require('../services/email/email-service');
const { genId } = require('../services/helpers');
const { getDb } = require('../db/connection');

const router = Router();

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

router.get('/auth/google', (req, res) => {
  try {
    const url = gmailProvider.getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate auth URL', details: err.message });
  }
});

router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const result = await gmailProvider.handleCallback(code);

    res.send(`
      <!DOCTYPE html>
      <html><head><title>Gmail Connected</title>
      <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f0f1a;color:#e0e0e0}
      .card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:40px;text-align:center;max-width:400px}
      .check{font-size:48px;margin-bottom:16px}h2{margin:0 0 8px;color:#00d4aa}
      p{color:#888;margin:0 0 24px}.btn{background:#00d4aa;color:#000;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block;font-weight:600}
      .btn:hover{background:#00eabb}</style></head>
      <body><div class="card"><div class="check">&#10003;</div>
      <h2>Gmail Connected</h2>
      <p>${escapeHtml(result.email)} (${escapeHtml(result.status)})</p>
      <a class="btn" onclick="window.close();opener.focus();">Done</a>
      </div></body></html>
    `);
  } catch (err) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title>
      <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f0f1a;color:#e0e0e0}
      .card{background:#1a1a2e;border:1px solid #ff4444;border-radius:12px;padding:40px;text-align:center;max-width:400px}
      h2{color:#ff4444}p{color:#888}</style></head>
      <body><div class="card"><h2>Connection Failed</h2><p>${String(err.message).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div></body></html>
    `);
  }
});

router.get('/accounts', (req, res) => {
  try {
    const accounts = emailService.getAccounts();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', (req, res) => {
  try {
    emailService.deleteAccount(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts/smtp', (req, res) => {
  try {
    const { email, displayName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body;
    if (!email || !smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      return res.status(400).json({ error: 'email, smtpHost, smtpPort, smtpUser, smtpPass are required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM email_accounts WHERE email = ? AND provider = ?').get(email, 'smtp');

    const id = genId();
    if (existing) {
      db.prepare(`
        UPDATE email_accounts
        SET displayName = ?, smtpHost = ?, smtpPort = ?, smtpSecure = ?, smtpUser = ?, smtpPass = ?, updatedAt = datetime('now')
        WHERE id = ?
      `).run(displayName || email.split('@')[0], smtpHost, smtpPort, smtpSecure ? 'true' : 'false', smtpUser, smtpPass, existing.id);
      return res.json({ id: existing.id, email, displayName, status: 'updated' });
    }

    db.prepare(`
      INSERT INTO email_accounts (id, provider, email, displayName, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, status)
      VALUES (?, 'smtp', ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(id, email, displayName || email.split('@')[0], smtpHost, smtpPort, smtpSecure ? 'true' : 'false', smtpUser, smtpPass);

    res.json({ id, email, displayName, status: 'connected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
