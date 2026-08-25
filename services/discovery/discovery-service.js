const { getDb } = require('../../db/connection');
const { genId, now } = require('../helpers');
const overpass = require('./overpass-provider');

async function runSearch(params) {
  const { country, city, industry, businessType, minScore = 0 } = params;
  const db = getDb();

  const searchId = genId();
  db.prepare(`
    INSERT INTO discovery_searches (id, country, city, industry, businessType, minScore, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
  `).run(searchId, country, city || null, industry || null, businessType, minScore);

  try {
    const rawResults = await overpass.search(city, country, businessType);

    const normalizedResults = rawResults.map(raw => ({
      ...raw,
      industry: industry || inferIndustry(raw, businessType),
    }));

    const insertStmt = db.prepare(`
      INSERT INTO discovery_results (id, searchId, normalizedData, status)
      VALUES (?, ?, ?, 'discovered')
    `);

    const results = [];
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        const resultId = genId();
        insertStmt.run(resultId, searchId, JSON.stringify(item));
        results.push({ id: resultId, ...item });
      }
    });

    insertMany(normalizedResults);

    db.prepare(`
      UPDATE discovery_searches SET resultCount = ?, status = 'completed' WHERE id = ?
    `).run(results.length, searchId);

    console.log(`[Discovery] Search ${searchId}: ${results.length} results`);

    return { searchId, results, total: results.length };
  } catch (err) {
    db.prepare(`
      UPDATE discovery_searches SET status = 'failed' WHERE id = ?
    `).run(searchId);
    throw err;
  }
}

function getSearches() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM discovery_searches ORDER BY createdAt DESC LIMIT 50
  `).all();
}

function getSearchById(id) {
  const db = getDb();
  const search = db.prepare(`SELECT * FROM discovery_searches WHERE id = ?`).get(id);
  if (!search) return null;

  const results = db.prepare(`
    SELECT * FROM discovery_results WHERE searchId = ? ORDER BY createdAt DESC
  `).all(id);

  return { ...search, results };
}

function inferIndustry(raw, businessType) {
  if (raw.cuisine) return 'Food & Beverage';
  const typeMap = {
    hotel: 'Hospitality',
    restaurant: 'Food & Beverage',
    cafe: 'Food & Beverage',
    retail: 'Retail',
    hospitality: 'Hospitality',
  };
  return typeMap[businessType] || 'Other';
}

module.exports = { runSearch, getSearches, getSearchById };
