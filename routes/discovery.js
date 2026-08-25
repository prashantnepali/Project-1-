const express = require('express');
const router = express.Router();
const discoveryService = require('../services/discovery/discovery-service');

router.post('/', async (req, res) => {
  try {
    const { country, city, industry, businessType, minScore } = req.body;

    if (!country || !businessType) {
      return res.status(400).json({ error: 'country and businessType are required' });
    }

    const result = await discoveryService.runSearch({ country, city, industry, businessType, minScore });
    res.json(result);
  } catch (err) {
    console.error('[API] Discovery error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const searches = discoveryService.getSearches();
    res.json(searches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const search = discoveryService.getSearchById(req.params.id);
    if (!search) return res.status(404).json({ error: 'Search not found' });
    res.json(search);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
