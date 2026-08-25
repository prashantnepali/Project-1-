const { getDb } = require('../db/connection');

function prequalify(normalizedResult) {
  const reasons = [];
  let score = 0;

  if (normalizedResult.name && normalizedResult.name.length > 1) {
    score += 15;
    reasons.push({ check: 'valid_name', passed: true, points: 15 });
  } else {
    reasons.push({ check: 'valid_name', passed: false, points: 0 });
  }

  if (normalizedResult.website) {
    score += 20;
    reasons.push({ check: 'has_website', passed: true, points: 20 });
  } else {
    reasons.push({ check: 'has_website', passed: false, points: 0 });
  }

  if (normalizedResult.phone) {
    score += 10;
    reasons.push({ check: 'has_phone', passed: true, points: 10 });
  } else {
    reasons.push({ check: 'has_phone', passed: false, points: 0 });
  }

  if (normalizedResult.address) {
    score += 10;
    reasons.push({ check: 'has_address', passed: true, points: 10 });
  } else {
    reasons.push({ check: 'has_address', passed: false, points: 0 });
  }

  if (normalizedResult.latitude && normalizedResult.longitude) {
    score += 10;
    reasons.push({ check: 'has_coordinates', passed: true, points: 10 });
  } else {
    reasons.push({ check: 'has_coordinates', passed: false, points: 0 });
  }

  if (normalizedResult.brand) {
    score += 10;
    reasons.push({ check: 'has_brand', passed: true, points: 10 });
  } else {
    reasons.push({ check: 'has_brand', passed: false, points: 0 });
  }

  if (!normalizedResult.isDuplicate) {
    score += 15;
    reasons.push({ check: 'not_duplicate', passed: true, points: 15 });
  } else {
    reasons.push({ check: 'not_duplicate', passed: false, points: 0 });
  }

  if (normalizedResult.email) {
    score += 10;
    reasons.push({ check: 'has_email', passed: true, points: 10 });
  } else {
    reasons.push({ check: 'has_email', passed: false, points: 0 });
  }

  let status;
  if (score >= 70) status = 'prequalified';
  else if (score >= 40) status = 'maybe';
  else status = 'rejected';

  return { score, status, reasons };
}

function batchPrequalify(results) {
  const db = getDb();
  const updateStmt = db.prepare(`
    UPDATE discovery_results
    SET prequalificationStatus = ?, prequalificationScore = ?, prequalificationReasons = ?
    WHERE id = ?
  `);

  const qualified = [];
  const rejected = [];

  const runBatch = db.transaction((items) => {
    for (const result of items) {
      const qual = prequalify(result);
      updateStmt.run(qual.status, qual.score, JSON.stringify(qual.reasons), result.id);

      if (qual.status === 'prequalified') {
        qualified.push({ ...result, prequalification: qual });
      } else {
        rejected.push({ ...result, prequalification: qual });
      }
    }
  });

  runBatch(results);

  console.log(`[Prequalify] ${qualified.length} qualified, ${rejected.length} rejected out of ${results.length}`);

  return { qualified, rejected, total: results.length };
}

module.exports = { prequalify, batchPrequalify };
