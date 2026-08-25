const express = require('express');
const router = express.Router();
const { getActivities } = require('../services/activity-service');

router.get('/', (req, res) => {
  try {
    const { leadId, companyId, type, limit } = req.query;
    const activities = getActivities({
      leadId, companyId, type,
      limit: limit ? parseInt(limit) : 50,
    });
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
