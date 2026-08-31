const { Router } = require('express');
const { getDb } = require('../db/connection');
const { genId } = require('../services/helpers');

const router = Router();

// Tracking pixel for email opens
router.get('/open/:sendId', (req, res) => {
  try {
    const db = getDb();
    const sendId = req.params.sendId;

    const send = db.prepare('SELECT * FROM email_sends WHERE id = ?').get(sendId);
    if (!send) {
      return res.status(404).send('Not found');
    }

    // Only track first open
    if (!send.openedAt) {
      const now = new Date().toISOString();

      db.prepare('UPDATE email_sends SET openedAt = ? WHERE id = ?').run(now, sendId);

      // Increment campaign opened count
      if (send.campaignId) {
        db.prepare('UPDATE campaigns SET opened = opened + 1 WHERE id = ?').run(send.campaignId);

        // Update campaign_leads openedAt
        db.prepare(`
          UPDATE campaign_leads SET openedAt = ?
          WHERE campaignId = ? AND leadId = ? AND openedAt IS NULL
        `).run(now, send.campaignId, send.leadId);
      }

      // Track activity for all opens
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'email_opened', ?, ?, ?)
      `).run(
        genId(), send.leadId || null, null,
        `Email opened: ${send.subject}`,
        JSON.stringify({ sendId, messageId: send.messageId, campaignId: send.campaignId }),
        now
      );
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.send(pixel);
  } catch (err) {
    console.error('Tracking pixel error:', err);
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  }
});

// Click tracking redirect
router.get('/click/:sendId', (req, res) => {
  try {
    const db = getDb();
    const sendId = req.params.sendId;
    let url = req.query.url || '/';
    // Prevent open redirect to dangerous schemes
    if (/^\s*(javascript|data|vbscript):/i.test(url)) url = '/';

    const send = db.prepare('SELECT * FROM email_sends WHERE id = ?').get(sendId);
    if (!send) {
      return res.redirect(url);
    }

    const now = new Date().toISOString();

    // Only track first click
    if (!send.clickedAt) {
      db.prepare('UPDATE email_sends SET clickedAt = ? WHERE id = ?').run(now, sendId);

      // Increment campaign clicked count
      if (send.campaignId) {
        db.prepare('UPDATE campaigns SET clicked = clicked + 1 WHERE id = ?').run(send.campaignId);
      }

      // Track activity for all clicks
      db.prepare(`
        INSERT INTO activities (id, leadId, companyId, type, description, metadata, timestamp)
        VALUES (?, ?, ?, 'link_clicked', ?, ?, ?)
      `).run(
        genId(), send.leadId || null, null,
        `Link clicked in email: ${send.subject}`,
        JSON.stringify({ sendId, url, messageId: send.messageId, campaignId: send.campaignId }),
        now
      );
    }

    res.redirect(url);
  } catch (err) {
    console.error('Click tracking error:', err);
    res.redirect(req.query.url || '/');
  }
});

module.exports = router;
