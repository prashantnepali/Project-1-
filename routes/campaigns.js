const { Router } = require('express');
const campaignService = require('../services/campaign/campaign-service');
const emailService = require('../services/email/email-service');

const router = Router();

router.get('/metrics', (req, res) => {
  try {
    res.json(campaignService.getAllMetrics());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    res.json(campaignService.getCampaigns({
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const campaign = campaignService.getCampaignMetrics(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const campaign = campaignService.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const campaign = campaignService.updateCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    campaignService.deleteCampaign(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/leads', (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!leadIds?.length) return res.status(400).json({ error: 'leadIds required' });
    const added = campaignService.assignLeads(req.params.id, leadIds);
    res.json({ added });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/leads', (req, res) => {
  try {
    res.json(campaignService.getCampaignLeads(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/leads/:leadId', (req, res) => {
  try {
    campaignService.removeLead(req.params.id, req.params.leadId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const result = await campaignService.sendCampaign(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
