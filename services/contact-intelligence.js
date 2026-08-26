const { getDb } = require('../db/connection');
const { genId, now } = require('./helpers');
const tavily = require('./enrichment/tavily-provider');

async function researchContacts(companyId) {
  const db = getDb();
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId);
  if (!company) throw new Error('Company not found');

  try {
    const result = await tavily.researchDecisionMakers(
      company.name,
      company.industry,
      null
    );

    const contacts = parseContacts(result, companyId);

    const insertStmt = db.prepare(`
      INSERT INTO contacts (id, companyId, name, title, linkedinUrl, source, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const saved = [];
    const saveContacts = db.transaction((items) => {
      for (const contact of items) {
        const id = genId();
        insertStmt.run(id, companyId, contact.name, contact.title, contact.linkedinUrl, contact.source, contact.confidence);
        saved.push({ id, ...contact });
      }
    });

    saveContacts(contacts);

    return saved;
  } catch (err) {
    return [];
  }
}

function parseContacts(tavilyResult, companyId) {
  const contacts = [];
  const seen = new Set();

  for (const result of tavilyResult.results) {
    const text = result.content || '';
    const title = result.title || '';

    const namePatterns = [
      /(?:CEO|CTO|CMO|COO|Founder|Co-Founder|Director|Manager|Head|VP|President|Chief)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g,
      /([A-Z][a-z]+\s[A-Z][a-z]+)(?:\s*[-–|]\s*)(?:CEO|CTO|CMO|COO|Founder|Director|Manager|Head|VP)/g,
    ];

    const linkedinMatch = text.match(/linkedin\.com\/in\/([a-z0-9\-]+)/gi) || [];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1] || match[0];
        const cleanName = name.replace(/^.*?([A-Z][a-z]+(?:\s[A-Z][a-z]+)+).*$/, '$1').trim();

        if (cleanName.length < 3 || cleanName.length > 50 || seen.has(cleanName.toLowerCase())) continue;
        if (/^(the|this|that|our|your|his|her|its|our)\s/i.test(cleanName)) continue;

        seen.add(cleanName.toLowerCase());

        const titleMatch = text.match(new RegExp(`${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*(CEO|CTO|CMO|COO|Founder|Co-Founder|Director|Manager|Head|VP|President|Chief)[^.]*`, 'i'));

        contacts.push({
          name: cleanName,
          title: titleMatch ? titleMatch[1] : extractTitle(text, cleanName),
          linkedinUrl: linkedinMatch.length > 0 ? `https://www.${linkedinMatch[0]}` : null,
          source: result.url,
          confidence: Math.min(80, Math.round((result.score || 0.5) * 100)),
        });
      }
    }
  }

  return contacts.slice(0, 5);
}

function extractTitle(text, name) {
  const titleKeywords = [
    'CEO', 'CTO', 'CMO', 'COO', 'CFO', 'Founder', 'Co-Founder',
    'Director', 'Manager', 'Head', 'VP', 'President', 'Chief',
    'General Manager', 'Marketing Director', 'Operations Director',
  ];

  const nameIdx = text.toLowerCase().indexOf(name.toLowerCase());
  if (nameIdx === -1) return null;

  const context = text.slice(nameIdx, nameIdx + 200);
  for (const kw of titleKeywords) {
    if (context.toLowerCase().includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}

function getContactsByCompany(companyId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM contacts WHERE companyId = ? ORDER BY confidence DESC`).all(companyId);
}

module.exports = { researchContacts, getContactsByCompany };
