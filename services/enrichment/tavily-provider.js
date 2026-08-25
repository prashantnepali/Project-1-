const fetch = require('node-fetch');

const TAVILY_API_URL = 'https://api.tavily.com/search';

async function search(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const maxResults = options.maxResults || 5;
  const searchDepth = options.searchDepth || 'basic';
  const includeAnswer = options.includeAnswer !== false;

  console.log(`[Tavily] Searching: "${query.slice(0, 80)}..."`);

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: includeAnswer,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 401) throw new Error('Tavily: Invalid API key');
    if (response.status === 429) throw new Error('Tavily: Rate limit exceeded');
    throw new Error(`Tavily API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();

  return {
    answer: data.answer || null,
    results: (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
  };
}

async function researchCompany(companyName, website, city, country) {
  const parts = [companyName];
  if (website) parts.push(website);
  parts.push('company information');

  const query = parts.join(' ');
  return search(query, { maxResults: 7, searchDepth: 'advanced' });
}

async function researchDecisionMakers(companyName, industry, titleKeywords) {
  const titles = titleKeywords || getDefaultTitles(industry);
  const query = `"${companyName}" ${titles.join(' OR ')} site:linkedin.com`;
  return search(query, { maxResults: 5, searchDepth: 'basic' });
}

function getDefaultTitles(industry) {
  const hospitalityTitles = [
    'General Manager', 'Director of Sales', 'Marketing Director',
    'Marketing Manager', 'Commercial Director', 'CRM Manager',
  ];
  const restaurantTitles = [
    'Founder', 'Owner', 'CEO', 'Managing Director', 'Marketing Director',
    'Head of Marketing', 'Operations Director',
  ];
  const defaultTitles = [
    'CEO', 'CTO', 'Marketing Director', 'Head of Growth', 'Founder',
  ];

  if (!industry) return defaultTitles;
  const ind = industry.toLowerCase();
  if (ind.includes('hospital') || ind.includes('hotel')) return hospitalityTitles;
  if (ind.includes('food') || ind.includes('beverage') || ind.includes('restaurant') || ind.includes('cafe')) return restaurantTitles;
  return defaultTitles;
}

module.exports = { search, researchCompany, researchDecisionMakers };
