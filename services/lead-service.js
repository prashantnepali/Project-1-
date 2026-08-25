const { getDb } = require('../db/connection');
const { genId, now } = require('./helpers');
const { calculateFitScore } = require('./fit-scoring');
const { researchContacts, getContactsByCompany } = require('./contact-intelligence');

async function addToLeads(companyId, userId) {
  const db = getDb();
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId);
  if (!company) throw new Error('Company not found');

  const existing = db.prepare(`SELECT id FROM leads WHERE companyId = ? AND userId = ?`).get(companyId, userId);
  if (existing) throw new Error('Company is already a lead');

  let fitScore = db.prepare(`SELECT * FROM lead_scores WHERE companyId = ? ORDER BY calculatedAt DESC LIMIT 1`).get(companyId);
  if (!fitScore) {
    fitScore = calculateFitScore(companyId);
  }

  let contacts = getContactsByCompany(companyId);
  if (contacts.length === 0) {
    contacts = await researchContacts(companyId);
  }

  const primaryContact = contacts[0] || null;
  const leadId = genId();

  db.prepare(`
    INSERT INTO leads (id, companyId, name, firstName, lastName, email, phone, company, title,
      industry, location, source, status, priority, score, fitScoreId, userId, createdAt, lastActivity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
  `).run(
    leadId,
    companyId,
    company.name,
    company.name.split(' ')[0],
    company.name.split(' ').slice(1).join(' '),
    primaryContact?.email || company.email || null,
    primaryContact?.phone || company.phone || null,
    company.name,
    primaryContact?.title || null,
    company.industry,
    [company.city, company.country].filter(Boolean).join(', '),
    company.source || 'discovery',
    fitScore.totalScore >= 60 ? 'medium' : 'low',
    fitScore.totalScore,
    fitScore.id,
    userId,
    now(),
    now()
  );

  const tags = [company.industry, company.source].filter(Boolean);
  const insertTag = db.prepare(`INSERT OR IGNORE INTO lead_tags (leadId, tag) VALUES (?, ?)`);
  for (const tag of tags) {
    insertTag.run(leadId, tag);
  }

  db.prepare(`UPDATE leads SET tags = ? WHERE id = ?`).run(JSON.stringify(tags), leadId);

  db.prepare(`UPDATE discovery_results SET status = 'added_to_leads' WHERE companyId = ?`).run(companyId);

  addActivity(leadId, companyId, 'added_to_leads', `Added ${company.name} to leads`);
  addActivity(null, companyId, 'company_discovered', `${company.name} discovered from ${company.source || 'discovery'}`);

  console.log(`[LeadService] ${company.name} added as lead (score: ${fitScore.totalScore})`);

  return { leadId, companyId, fitScore };
}

function addActivity(leadId, companyId, type, description, metadata = {}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO activities (id, leadId, companyId, type, description, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(genId(), leadId, companyId, type, description, JSON.stringify(metadata));
}

function getLeads(filters = {}) {
  const db = getDb();
  let query = `
    SELECT l.*, ls.totalScore as fitScore, ls.classification as fitClassification, ls.breakdown as fitBreakdown
    FROM leads l
    LEFT JOIN lead_scores ls ON l.fitScoreId = ls.id
    WHERE l.userId = ?
  `;
  const params = [filters.userId];

  if (filters.search) {
    query += ` AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  if (filters.status) {
    query += ` AND l.status = ?`;
    params.push(filters.status);
  }
  if (filters.priority) {
    query += ` AND l.priority = ?`;
    params.push(filters.priority);
  }
  if (filters.industry) {
    query += ` AND l.industry = ?`;
    params.push(filters.industry);
  }
  if (filters.source) {
    query += ` AND l.source = ?`;
    params.push(filters.source);
  }

  query += ` ORDER BY l.createdAt DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }
  if (filters.offset) {
    query += ` OFFSET ?`;
    params.push(filters.offset);
  }

  return db.prepare(query).all(...params);
}

function getLeadById(id, userId) {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, ls.totalScore as fitScore, ls.classification as fitClassification, ls.breakdown as fitBreakdown
    FROM leads l
    LEFT JOIN lead_scores ls ON l.fitScoreId = ls.id
    WHERE l.id = ? AND l.userId = ?
  `).get(id, userId);

  if (!lead) return null;

  const company = lead.companyId ? db.prepare(`SELECT * FROM companies WHERE id = ?`).get(lead.companyId) : null;
  const contacts = lead.companyId ? getContactsByCompany(lead.companyId) : [];
  const activities = db.prepare(`SELECT * FROM activities WHERE leadId = ? OR companyId = ? ORDER BY timestamp DESC`).all(id, lead.companyId);
  const evidenceItems = lead.companyId ? db.prepare(`SELECT * FROM evidence WHERE companyId = ? ORDER BY confidence DESC`).all(lead.companyId) : [];
  const enrichment = lead.companyId ? db.prepare(`SELECT data FROM enrichments WHERE companyId = ? AND status = 'completed' ORDER BY version DESC LIMIT 1`).get(lead.companyId) : null;

  return {
    ...lead,
    companyData: company,
    contacts,
    activities,
    evidence: evidenceItems,
    enrichmentData: enrichment ? JSON.parse(enrichment.data || '{}') : null,
    tags: JSON.parse(lead.tags || '[]'),
  };
}

function updateLead(id, updates, userId) {
  const db = getDb();

  const existing = db.prepare(`SELECT id FROM leads WHERE id = ? AND userId = ?`).get(id, userId);
  if (!existing) return null;

  const fields = [];
  const params = [];

  const allowed = ['name', 'company', 'status', 'priority', 'score', 'notes', 'email', 'phone', 'title', 'industry', 'location', 'source'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }

  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }

  fields.push('lastActivity = ?');
  params.push(now());
  params.push(id);

  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getLeadById(id, userId);
}

function deleteLead(id, userId) {
  const db = getDb();
  db.prepare(`DELETE FROM leads WHERE id = ? AND userId = ?`).run(id, userId);
}

function addManualLead(data) {
  const db = getDb();
  const id = genId();
  const name = data.name || 'Unknown';
  const tags = data.tags || [data.industry, data.source].filter(Boolean);

  db.prepare(`
    INSERT INTO leads (id, name, firstName, lastName, email, phone, company, title,
      industry, location, source, status, priority, score, tags, notes, userId, createdAt, lastActivity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, name.split(' ')[0], name.split(' ').slice(1).join(' '),
    data.email, data.phone, data.company, data.title,
    data.industry, data.location, data.source,
    data.priority || 'medium', data.score || 50,
    JSON.stringify(tags), data.notes || '',
    data.userId,
    now(), now()
  );

  addActivity(id, null, 'manual_add', `Manually added ${name} as lead`);

  return getLeadById(id, data.userId);
}

function getMetrics(userId) {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE userId = ?`).get(userId).c;
  const newLeads = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'new' AND userId = ?`).get(userId).c;
  const qualified = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'qualified' AND userId = ?`).get(userId).c;
  const avgScore = db.prepare(`SELECT AVG(score) as avg FROM leads WHERE userId = ?`).get(userId).avg || 0;

  return {
    totalLeads: total,
    newLeads,
    qualified,
    avgScore: Math.round(avgScore),
  };
}

module.exports = { addToLeads, getLeads, getLeadById, updateLead, deleteLead, addManualLead, getMetrics, addActivity };
