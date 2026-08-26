require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./db/schema');
const { closeDb } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname)));

initSchema();

app.use('/api/discover', require('./routes/discovery'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/emails', require('./routes/emails'));
app.use(require('./routes/auth'));

app.delete('/api/data', (req, res) => {
  try {
    const { getDb } = require('./db/connection');
    const db = getDb();
    db.exec(`
      DELETE FROM email_replies;
      DELETE FROM email_sends;
      DELETE FROM campaign_leads;
      DELETE FROM campaigns;
      DELETE FROM email_accounts;
      DELETE FROM activities;
      DELETE FROM notes;
      DELETE FROM evidence;
      DELETE FROM enrichments;
      DELETE FROM lead_tags;
      DELETE FROM lead_scores;
      DELETE FROM leads;
      DELETE FROM discovery_results;
      DELETE FROM discovery_searches;
      DELETE FROM contacts;
      DELETE FROM companies;
      DELETE FROM settings;
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.4.0' });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

const server = app.listen(PORT, () => {
  console.log(`[Samparka] Lead Engine running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  closeDb();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  server.close();
  process.exit(0);
});
