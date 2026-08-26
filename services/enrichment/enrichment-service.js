const { getDb } = require('../../db/connection');
const { genId, now } = require('../helpers');
const tavily = require('./tavily-provider');

async function enrichCompany(companyId) {
  const db = getDb();
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId);
  if (!company) throw new Error('Company not found');

  const existing = db.prepare(`
    SELECT * FROM enrichments WHERE companyId = ? ORDER BY version DESC LIMIT 1
  `).get(companyId);

  if (existing && existing.status === 'completed') {
    const lastEnriched = new Date(existing.lastEnrichedAt);
    const hoursSince = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      return { enrichmentId: existing.id, cached: true, data: JSON.parse(existing.data || '{}') };
    }
  }

  const enrichmentId = genId();
  const version = existing ? existing.version + 1 : 1;

  db.prepare(`
    INSERT INTO enrichments (id, companyId, provider, version, status, createdAt)
    VALUES (?, ?, 'tavily', ?, 'enriching', ?)
  `).run(enrichmentId, companyId, version, now());

  try {
    const tavilyResult = await tavily.researchCompany(
      company.name,
      company.website,
      company.city,
      company.country
    );

    const enrichmentData = parseTavilyResults(tavilyResult, company);

    db.prepare(`
      UPDATE enrichments
      SET data = ?, status = 'completed', lastEnrichedAt = ?
      WHERE id = ?
    `).run(JSON.stringify(enrichmentData), now(), enrichmentId);

    updateCompanyFromEnrichment(companyId, enrichmentData);

    await storeEvidence(companyId, enrichmentId, tavilyResult.results);

    return { enrichmentId, cached: false, data: enrichmentData };
  } catch (err) {
    const fallbackData = {
      description: null,
      numberOfLocations: null,
      socialProfiles: {},
      loyaltyProgram: 'unknown',
      digitalPresence: 'unknown',
      companyIntelligence: null,
      relevantSignals: [],
      rawResults: [],
      _note: 'Enrichment unavailable: ' + err.message,
    };

    db.prepare(`
      UPDATE enrichments
      SET data = ?, status = 'partial', error = ?, lastEnrichedAt = ?
      WHERE id = ?
    `).run(JSON.stringify(fallbackData), err.message, now(), enrichmentId);

    return { enrichmentId, cached: false, partial: true, data: fallbackData };
  }
}

function parseTavilyResults(tavilyResult, company) {
  const data = {
    description: null,
    numberOfLocations: null,
    socialProfiles: {},
    loyaltyProgram: null,
    digitalPresence: 'unknown',
    companyIntelligence: tavilyResult.answer || null,
    relevantSignals: [],
    rawResults: tavilyResult.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 300),
    })),
  };

  const allText = [
    tavilyResult.answer || '',
    ...tavilyResult.results.map(r => r.content || ''),
  ].join(' ').toLowerCase();

  if (allText.includes('loyalty') || allText.includes('rewards program') || allText.includes('membership')) {
    data.loyaltyProgram = 'detected';
    data.relevantSignals.push('Has existing loyalty/rewards program');
  } else if (allText.includes('no loyalty') || allText.includes('without loyalty')) {
    data.loyaltyProgram = 'none_detected';
    data.relevantSignals.push('No loyalty program detected');
  } else {
    data.loyaltyProgram = 'unknown';
  }

  const locationMatch = allText.match(/(\d+)\s*(?:location|branch|outlet|store|hotel|restaurant)/i);
  if (locationMatch) {
    data.numberOfLocations = parseInt(locationMatch[1]);
  }

  if (allText.includes('linkedin.com')) {
    const linkedinMatch = allText.match(/linkedin\.com\/company\/[a-z0-9\-]+/i);
    if (linkedinMatch) {
      data.socialProfiles.linkedin = `https://www.${linkedinMatch[0]}`;
    }
  }

  if (allText.includes('twitter.com') || allText.includes('x.com')) {
    data.relevantSignals.push('Active on social media');
  }

  if (tavilyResult.results.length >= 3) {
    data.digitalPresence = 'strong';
  } else if (tavilyResult.results.length >= 1) {
    data.digitalPresence = 'moderate';
  } else {
    data.digitalPresence = 'weak';
  }

  return data;
}

function updateCompanyFromEnrichment(companyId, data) {
  const db = getDb();
  const updates = [];
  const params = [];

  if (data.description) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.numberOfLocations) {
    updates.push('numberOfLocations = ?');
    params.push(data.numberOfLocations);
  }
  if (Object.keys(data.socialProfiles).length > 0) {
    updates.push('socialProfiles = ?');
    params.push(JSON.stringify(data.socialProfiles));
  }

  updates.push('status = ?');
  params.push('enriched');
  updates.push('updatedAt = ?');
  params.push(now());
  params.push(companyId);

  db.prepare(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

async function storeEvidence(companyId, enrichmentId, results) {
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT INTO evidence (id, companyId, enrichmentId, field, value, sourceUrl, sourceTitle, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const result of results) {
    insertStmt.run(
      genId(), companyId, enrichmentId,
      'research_source', result.content?.slice(0, 500) || null,
      result.url, result.title, Math.round((result.score || 0.5) * 100)
    );
  }
}

function getEnrichment(companyId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM enrichments WHERE companyId = ? ORDER BY version DESC LIMIT 1
  `).get(companyId);
}

module.exports = { enrichCompany, getEnrichment };
