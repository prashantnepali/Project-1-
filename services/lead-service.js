const { getDb } = require('../db/connection');
const { genId, now } = require('./helpers');
const { calculateFitScore } = require('./fit-scoring');
const { researchContacts, getContactsByCompany } = require('./contact-intelligence');

async function addToLeads(companyId) {
  const db = getDb();
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId);
  if (!company) throw new Error('Company not found');

  const existing = db.prepare(`SELECT id FROM leads WHERE companyId = ?`).get(companyId);
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
      industry, location, source, status, priority, score, fitScoreId, createdAt, lastActivity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)
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
    WHERE 1=1
  `;
  const params = [];

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

function getLeadById(id) {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, ls.totalScore as fitScore, ls.classification as fitClassification, ls.breakdown as fitBreakdown
    FROM leads l
    LEFT JOIN lead_scores ls ON l.fitScoreId = ls.id
    WHERE l.id = ?
  `).get(id);

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

function updateLead(id, updates) {
  const db = getDb();
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

  return getLeadById(id);
}

function deleteLead(id) {
  const db = getDb();
  db.prepare(`DELETE FROM leads WHERE id = ?`).run(id);
}

function addManualLead(data) {
  const db = getDb();
  const id = genId();
  const name = data.name || 'Unknown';
  const tags = data.tags || [data.industry, data.source].filter(Boolean);

  const breakdown = {
    industryFit: { points: 0, max: 20 },
    repeatCustomerPotential: { points: 0, max: 20 },
    multipleLocations: { points: 0, max: 15 },
    digitalPresence: { points: 0, max: 10 },
    decisionMakerFound: { points: 0, max: 15 },
    contactAvailable: { points: (data.email || data.phone) ? 10 : 0, max: 10 },
    noLoyaltyProgram: { points: 0, max: 10 },
  };
  const totalScore = data.score || 50;
  const fitScoreId = genId();
  db.prepare(`INSERT INTO lead_scores (id, companyId, totalScore, classification, breakdown) VALUES (?, NULL, ?, ?, ?)`).run(
    fitScoreId, totalScore, totalScore >= 70 ? 'High Priority' : totalScore >= 40 ? 'Medium Priority' : 'Low Priority',
    JSON.stringify(breakdown)
  );

  db.prepare(`
    INSERT INTO leads (id, name, firstName, lastName, email, phone, company, title,
      industry, location, source, status, priority, score, tags, notes, fitScoreId, createdAt, lastActivity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, name.split(' ')[0], name.split(' ').slice(1).join(' '),
    data.email, data.phone, data.company, data.title,
    data.industry, data.location, data.source,
    data.priority || 'medium', totalScore,
    JSON.stringify(tags), data.notes || '',
    fitScoreId, now(), now()
  );

  addActivity(id, null, 'manual_add', `Manually added ${name} as lead`);

  return getLeadById(id);
}

function getMetrics() {
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) as c FROM leads`).get().c;
  const newLeads = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'new'`).get().c;
  const qualified = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status = 'qualified'`).get().c;
  const inPipeline = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE status NOT IN ('new', 'customer')`).get().c;
  const avgScore = db.prepare(`SELECT AVG(score) as avg FROM leads`).get().avg || 0;

  return {
    totalLeads: total,
    newLeads,
    qualified,
    inPipeline,
    avgScore: Math.round(avgScore),
  };
}

module.exports = { addToLeads, getLeads, getLeadById, updateLead, deleteLead, addManualLead, getMetrics, addActivity };
