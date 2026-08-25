const { getDb } = require('../db/connection');
const { genId, now } = require('./helpers');

const DEFAULT_WEIGHTS = {
  industryFit: 20,
  repeatCustomerPotential: 20,
  multipleLocations: 15,
  digitalPresence: 10,
  decisionMakerFound: 15,
  contactAvailable: 10,
  noLoyaltyProgram: 10,
};

const INDUSTRIES_WITH_REPEAT = [
  'hospitality', 'hotel', 'food & beverage', 'restaurant', 'cafe',
  'retail', 'grocery', 'fitness', 'health', 'beauty', 'spa',
];

function calculateFitScore(companyId, weights = DEFAULT_WEIGHTS) {
  const db = getDb();
  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId);
  if (!company) throw new Error('Company not found');

  const contacts = db.prepare(`SELECT * FROM contacts WHERE companyId = ?`).all(companyId);
  const enrichment = db.prepare(`SELECT data FROM enrichments WHERE companyId = ? AND status = 'completed' ORDER BY version DESC LIMIT 1`).get(companyId);

  const enrichData = enrichment ? JSON.parse(enrichment.data || '{}') : {};

  const breakdown = {};
  let totalScore = 0;

  breakdown.industryFit = scoreIndustryFit(company, weights.industryFit);
  totalScore += breakdown.industryFit.points;

  breakdown.repeatCustomerPotential = scoreRepeatPotential(company, enrichData, weights.repeatCustomerPotential);
  totalScore += breakdown.repeatCustomerPotential.points;

  breakdown.multipleLocations = scoreLocations(company, enrichData, weights.multipleLocations);
  totalScore += breakdown.multipleLocations.points;

  breakdown.digitalPresence = scoreDigitalPresence(company, enrichData, weights.digitalPresence);
  totalScore += breakdown.digitalPresence.points;

  breakdown.decisionMakerFound = scoreDecisionMaker(contacts, weights.decisionMakerFound);
  totalScore += breakdown.decisionMakerFound.points;

  breakdown.contactAvailable = scoreContactInfo(company, contacts, weights.contactAvailable);
  totalScore += breakdown.contactAvailable.points;

  breakdown.noLoyaltyProgram = scoreNoLoyalty(enrichData, weights.noLoyaltyProgram);
  totalScore += breakdown.noLoyaltyProgram.points;

  const classification = classify(totalScore);

  const scoreId = genId();
  db.prepare(`
    INSERT OR REPLACE INTO lead_scores (id, companyId, totalScore, classification, breakdown, calculatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(scoreId, companyId, totalScore, classification, JSON.stringify(breakdown), now());

  return { id: scoreId, totalScore, classification, breakdown };
}

function scoreIndustryFit(company, max) {
  const industry = (company.industry || '').toLowerCase();
  const category = (company.category || '').toLowerCase();
  const combined = `${industry} ${category}`;

  if (combined.includes('hotel') || combined.includes('hospitality') || combined.includes('resort')) {
    return { points: max, max, reason: 'Hospitality business — high fit for Samparka' };
  }
  if (combined.includes('restaurant') || combined.includes('cafe') || combined.includes('food') || combined.includes('beverage')) {
    return { points: max, max, reason: 'Food & beverage business — high fit for Samparka' };
  }
  if (combined.includes('retail') || combined.includes('shop') || combined.includes('store')) {
    return { points: Math.round(max * 0.8), max, reason: 'Retail business — good fit for Samparka' };
  }
  if (combined.includes('fitness') || combined.includes('gym') || combined.includes('spa') || combined.includes('salon')) {
    return { points: Math.round(max * 0.7), max, reason: 'Service business — moderate fit for Samparka' };
  }
  return { points: Math.round(max * 0.3), max, reason: 'Industry may have limited repeat-customer potential' };
}

function scoreRepeatPotential(company, enrichData, max) {
  const industry = (company.industry || '').toLowerCase();
  const category = (company.category || '').toLowerCase();
  const combined = `${industry} ${category}`;

  for (const term of INDUSTRIES_WITH_REPEAT) {
    if (combined.includes(term)) {
      return { points: max, max, reason: 'High repeat-customer potential' };
    }
  }

  if (enrichData.loyaltyProgram === 'detected') {
    return { points: Math.round(max * 0.6), max, reason: 'Has repeat customers (loyalty program detected)' };
  }

  return { points: Math.round(max * 0.4), max, reason: 'Moderate repeat-customer potential' };
}

function scoreLocations(company, enrichData, max) {
  const count = enrichData.numberOfLocations || company.numberOfLocations || 1;
  if (count >= 5) return { points: max, max, reason: `${count} locations — high multi-location value` };
  if (count >= 3) return { points: Math.round(max * 0.8), max, reason: `${count} locations — good multi-location value` };
  if (count >= 2) return { points: Math.round(max * 0.5), max, reason: `${count} locations — moderate multi-location value` };
  return { points: Math.round(max * 0.2), max, reason: 'Single location' };
}

function scoreDigitalPresence(company, enrichData, max) {
  const presence = enrichData.digitalPresence || 'unknown';
  if (presence === 'strong') return { points: max, max, reason: 'Strong online presence' };
  if (presence === 'moderate') return { points: Math.round(max * 0.6), max, reason: 'Moderate online presence' };
  if (company.website) return { points: Math.round(max * 0.5), max, reason: 'Has website' };
  return { points: Math.round(max * 0.2), max, reason: 'Weak or unknown digital presence' };
}

function scoreDecisionMaker(contacts, max) {
  if (!contacts.length) return { points: 0, max, reason: 'No decision-makers identified' };

  const highValueTitles = [
    'ceo', 'cto', 'cmo', 'coo', 'founder', 'co-founder',
    'director', 'head', 'vp', 'president', 'chief', 'general manager',
    'marketing', 'commercial', 'growth',
  ];

  const hasKeyDecisionMaker = contacts.some(c => {
    const title = (c.title || '').toLowerCase();
    return highValueTitles.some(t => title.includes(t));
  });

  if (hasKeyDecisionMaker) return { points: max, max, reason: 'Key decision-maker identified' };
  if (contacts.length >= 2) return { points: Math.round(max * 0.6), max, reason: `${contacts.length} contacts found` };
  return { points: Math.round(max * 0.3), max, reason: 'Contact found but not a key decision-maker' };
}

function scoreContactInfo(company, contacts, max) {
  let points = 0;
  if (company.email) points += 4;
  if (company.phone) points += 3;
  if (contacts.some(c => c.email)) points += 3;

  const reason = points >= 7 ? 'Good contact information available'
    : points >= 3 ? 'Some contact information available'
    : 'Limited contact information';

  return { points: Math.min(points, max), max, reason };
}

function scoreNoLoyalty(enrichData, max) {
  if (enrichData.loyaltyProgram === 'none_detected') {
    return { points: max, max, reason: 'No existing loyalty program detected — opportunity for Samparka' };
  }
  if (enrichData.loyaltyProgram === 'detected') {
    return { points: 0, max, reason: 'Existing loyalty program detected — may be harder to convert' };
  }
  return { points: Math.round(max * 0.5), max, reason: 'Loyalty program status unknown' };
}

function classify(score) {
  if (score >= 80) return 'Excellent Fit';
  if (score >= 60) return 'Good Fit';
  if (score >= 40) return 'Maybe';
  return 'Low Priority';
}

function getFitScore(companyId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM lead_scores WHERE companyId = ? ORDER BY calculatedAt DESC LIMIT 1`).get(companyId);
}

module.exports = { calculateFitScore, getFitScore, DEFAULT_WEIGHTS, classify };
