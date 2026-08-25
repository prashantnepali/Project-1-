const { getDb } = require('../db/connection');

function getActivities(filters = {}) {
  const db = getDb();
  let query = `SELECT * FROM activities WHERE 1=1`;
  const params = [];

  if (filters.leadId) {
    query += ` AND leadId = ?`;
    params.push(filters.leadId);
  }
  if (filters.companyId) {
    query += ` AND companyId = ?`;
    params.push(filters.companyId);
  }
  if (filters.type) {
    query += ` AND type = ?`;
    params.push(filters.type);
  }

  query += ` ORDER BY timestamp DESC`;

  if (filters.limit) {
    query += ` LIMIT ?`;
    params.push(filters.limit);
  }

  return db.prepare(query).all(...params);
}

module.exports = { getActivities };
