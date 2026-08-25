const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { normalize } = require('../services/normalization');
const { findDuplicates, createCompany, linkResultToCompany } = require('../services/deduplication');
const { batchPrequalify } = require('../services/prequalification');
const { enrichCompany, getEnrichment } = require('../services/enrichment/enrichment-service');
const { researchContacts, getContactsByCompany } = require('../services/contact-intelligence');
const { calculateFitScore, getFitScore } = require('../services/fit-scoring');
const { addToLeads, addActivity } = require('../services/lead-service');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { searchId, status } = req.query;
    let query = `SELECT dr.*, c.name as companyName, c.website as companyWebsite FROM discovery_results dr LEFT JOIN companies c ON dr.companyId = c.id WHERE 1=1`;
    const params = [];

    if (searchId) {
      query += ` AND dr.searchId = ?`;
      params.push(searchId);
    }
    if (status) {
      query += ` AND dr.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY dr.createdAt DESC LIMIT 200`;
    const results = db.prepare(query).all(...params);

    const enriched = results.map(r => {
      const normalized = r.normalizedData ? JSON.parse(r.normalizedData) : null;
      const reasons = r.prequalificationReasons ? JSON.parse(r.prequalificationReasons) : [];
      let fitScore = null;
      if (r.companyId) {
        fitScore = getFitScore(r.companyId);
      }
      let contacts = [];
      if (r.companyId) {
        contacts = getContactsByCompany(r.companyId);
      }
      return {
        ...r,
        normalized,
        prequalificationReasons: reasons,
        fitScore: fitScore || null,
        contacts,
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/process', async (req, res) => {
  try {
    const { resultIds } = req.body;
    if (!resultIds || !resultIds.length) {
      return res.status(400).json({ error: 'resultIds required' });
    }

    const db = getDb();
    const results = [];
    for (const id of resultIds) {
      const row = db.prepare(`SELECT * FROM discovery_results WHERE id = ?`).get(id);
      if (row) results.push(row);
    }

    const normalizedResults = results.map(r => {
      const data = JSON.parse(r.normalizedData || '{}');
      return { ...data, id: r.id };
    });

    const deduplicated = findDuplicates(normalizedResults);

    for (const result of deduplicated) {
      if (result.isDuplicate && result.existingCompanyId) {
        linkResultToCompany(result.id, result.existingCompanyId);
        db.prepare(`UPDATE discovery_results SET companyId = ?, status = 'deduplicated' WHERE id = ?`).run(result.existingCompanyId, result.id);
      } else {
        const companyId = createCompany(result);
        linkResultToCompany(result.id, companyId);
        db.prepare(`UPDATE discovery_results SET companyId = ?, status = 'normalized' WHERE id = ?`).run(companyId, result.id);
        result.companyId = companyId;
        result.isDuplicate = false;
      }
    }

    const qualifiableResults = deduplicated.map(r => ({
      ...r,
      isDuplicate: r.isDuplicate || false,
    }));

    const { qualified, rejected } = batchPrequalify(qualifiableResults);

    for (const q of qualified) {
      db.prepare(`UPDATE discovery_results SET status = 'prequalified' WHERE id = ?`).run(q.id);
    }
    for (const r of rejected) {
      db.prepare(`UPDATE discovery_results SET status = 'rejected' WHERE id = ?`).run(r.id);
    }

    res.json({
      processed: results.length,
      duplicates: deduplicated.filter(r => r.isDuplicate).length,
      qualified: qualified.length,
      rejected: rejected.length,
    });
  } catch (err) {
    console.error('[API] Process error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/enrich', async (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare(`SELECT * FROM discovery_results WHERE id = ?`).get(req.params.id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    if (!result.companyId) {
      return res.status(400).json({ error: 'Result has no associated company. Process it first.' });
    }

    const enrichment = await enrichCompany(result.companyId);
    const contacts = await researchContacts(result.companyId);
    const fitScore = calculateFitScore(result.companyId);

    addActivity(null, result.companyId, 'research_completed', `Research completed for company`);

    res.json({ enrichment, contacts, fitScore });
  } catch (err) {
    console.error('[API] Enrich error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/add-to-lead', async (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare(`SELECT * FROM discovery_results WHERE id = ?`).get(req.params.id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    if (!result.companyId) {
      return res.status(400).json({ error: 'No company associated. Process and enrich first.' });
    }

    const leadResult = await addToLeads(result.companyId);
    res.json(leadResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk-add', async (req, res) => {
  try {
    const { resultIds } = req.body;
    if (!resultIds || !resultIds.length) {
      return res.status(400).json({ error: 'resultIds required' });
    }

    const db = getDb();
    const added = [];
    const errors = [];

    for (const id of resultIds) {
      try {
        const result = db.prepare(`SELECT * FROM discovery_results WHERE id = ?`).get(id);
        if (!result || !result.companyId) {
          errors.push({ id, error: 'No company associated' });
          continue;
        }
        const leadResult = await addToLeads(result.companyId);
        added.push(leadResult);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({ added: added.length, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
