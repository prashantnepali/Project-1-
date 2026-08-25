const { getDb } = require('../db/connection');
const { genId, now, normalizeCompanyName } = require('./helpers');

function findDuplicates(normalizedResults) {
  const db = getDb();
  const enriched = [];

  const existingCompanies = db.prepare(`
    SELECT id, name, normalizedName, domain, phone, sourceId, brand
    FROM companies
  `).all();

  const domainIndex = {};
  const phoneIndex = {};
  const nameIndex = {};
  const sourceIdIndex = {};

  for (const c of existingCompanies) {
    if (c.domain) domainIndex[c.domain.toLowerCase()] = c.id;
    if (c.phone) phoneIndex[c.phone] = c.id;
    if (c.normalizedName) nameIndex[c.normalizedName] = c.id;
    if (c.sourceId) sourceIdIndex[c.sourceId] = c.id;
  }

  for (const result of normalizedResults) {
    const match = findMatch(result, { domainIndex, phoneIndex, nameIndex, sourceIdIndex });

    enriched.push({
      ...result,
      existingCompanyId: match ? match.companyId : null,
      isDuplicate: !!(match && match.companyId),
      matchType: match ? match.type : null,
    });
  }

  return enriched;
}

function findMatch(result, indexes) {
  if (result.sourceId && indexes.sourceIdIndex[result.sourceId]) {
    return { companyId: indexes.sourceIdIndex[result.sourceId], type: 'sourceId' };
  }

  if (result.domain && indexes.domainIndex[result.domain.toLowerCase()]) {
    return { companyId: indexes.domainIndex[result.domain.toLowerCase()], type: 'domain' };
  }

  if (result.phone && indexes.phoneIndex[result.phone]) {
    return { companyId: indexes.phoneIndex[result.phone], type: 'phone' };
  }

  const normName = normalizeCompanyName(result.name);
  if (normName && indexes.nameIndex[normName]) {
    return { companyId: indexes.nameIndex[normName], type: 'name' };
  }

  return null;
}

function createCompany(normalizedResult) {
  const db = getDb();
  const id = genId();

  const name = normalizedResult.name
    || normalizedResult.brand
    || normalizedResult.rawTags?.operator
    || normalizedResult.rawTags?.description?.split(/[.,]/)[0]
    || normalizedResult.address
    || 'Unknown Business';

  db.prepare(`
    INSERT INTO companies (id, name, normalizedName, category, industry, country, city,
      address, latitude, longitude, website, phone, email, brand, source, sourceId, domain, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered')
  `).run(
    id,
    name,
    normalizeCompanyName(name),
    normalizedResult.category,
    normalizedResult.industry,
    normalizedResult.country,
    normalizedResult.city,
    normalizedResult.address,
    normalizedResult.latitude,
    normalizedResult.longitude,
    normalizedResult.website,
    normalizedResult.phone,
    normalizedResult.email,
    normalizedResult.brand,
    normalizedResult.source,
    normalizedResult.sourceId,
    normalizedResult.domain
  );

  return id;
}

function linkResultToCompany(resultId, companyId) {
  const db = getDb();
  db.prepare(`
    UPDATE discovery_results SET companyId = ? WHERE id = ?
  `).run(companyId, resultId);
}

module.exports = { findDuplicates, createCompany, linkResultToCompany };
