const fetch = require('node-fetch');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

const BUSINESS_TAGS = {
  hotel: ['tourism=hotel', 'tourism=hostel', 'tourism=motel', 'tourism=resort'],
  restaurant: ['amenity=restaurant', 'amenity=fast_food'],
  cafe: ['amenity=cafe', 'amenity=bar', 'amenity=pub'],
  retail: ['shop'],
  hospitality: ['tourism=hotel', 'tourism=hostel', 'tourism=resort', 'amenity=restaurant', 'amenity=cafe'],
};

const COUNTRY_CODES = {
  'united arab emirates': 'ae', 'uae': 'ae', 'dubai': 'ae',
  'united kingdom': 'gb', 'uk': 'gb', 'london': 'gb',
  'australia': 'au', 'sydney': 'au', 'melbourne': 'au',
  'singapore': 'sg',
  'united states': 'us', 'usa': 'us',
  'canada': 'ca',
  'germany': 'de',
  'france': 'fr',
  'japan': 'jp',
  'india': 'in',
  'nepal': 'np',
  'thailand': 'th',
  'malaysia': 'my',
  'indonesia': 'id',
  'philippines': 'ph',
  'south korea': 'kr',
  'new zealand': 'nz',
  'ireland': 'ie',
  'netherlands': 'nl',
  'spain': 'es',
  'italy': 'it',
  'portugal': 'pt',
  'switzerland': 'ch',
  'austria': 'at',
  'sweden': 'se',
  'norway': 'no',
  'denmark': 'dk',
  'finland': 'fi',
};

function getCountryCode(country) {
  if (!country) return null;
  return COUNTRY_CODES[country.toLowerCase()] || null;
}

function buildOverpassQuery(city, country, businessType) {
  const countryCode = getCountryCode(country);
  const tags = BUSINESS_TAGS[businessType] || BUSINESS_TAGS.hospitality;

  const unionParts = [];
  for (const tag of tags) {
    const [key, val] = tag.split('=');
    const tagFilter = val ? `["${key}"="${val}"]` : `["${key}"]`;

    if (city) {
      unionParts.push(`node${tagFilter}(area.searchArea)`);
      unionParts.push(`way${tagFilter}(area.searchArea)`);
    } else if (countryCode) {
      unionParts.push(`node${tagFilter}(area.searchArea)`);
      unionParts.push(`way${tagFilter}(area.searchArea)`);
    } else {
      unionParts.push(`node${tagFilter}`);
      unionParts.push(`way${tagFilter}`);
    }
  }

  let areaDecl = '';
  if (city && countryCode) {
    areaDecl = `area["ISO3166-1"="${countryCode.toUpperCase()}"]->.countryArea;
area["name"="${sanitizeOverpass(city)}"]["boundary"="administrative"](area.countryArea)->.searchArea;`;
  } else if (city) {
    areaDecl = `area["name"="${sanitizeOverpass(city)}"]["boundary"="administrative"]->.searchArea;`;
  } else if (countryCode) {
    areaDecl = `area["ISO3166-1"="${countryCode.toUpperCase()}"]->.searchArea;`;
  }

  return `
[out:json][timeout:60];
${areaDecl}
(
  ${unionParts.join(';\n  ')};
);
out body center tags;
`.trim();
}

function sanitizeOverpass(value) {
  if (!value) return '';
  return String(value).replace(/["\\]/g, '');
}

async function search(city, country, businessType, options = {}) {
  const query = buildOverpassQuery(city, country, businessType);
  const timeout = options.timeout || 60000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SamparkaLeadEngine/2.0 (lead-intelligence)',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Overpass API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    return elements.map(el => ({
      name: el.tags?.name || null,
      category: businessType,
      country: country,
      city: city || el.tags?.['addr:city'] || null,
      address: buildAddress(el.tags),
      latitude: el.lat != null ? el.lat : (el.center?.lat != null ? el.center.lat : null),
      longitude: el.lon != null ? el.lon : (el.center?.lon != null ? el.center.lon : null),
      website: el.tags?.website || el.tags?.['contact:website'] || null,
      phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
      email: el.tags?.email || el.tags?.['contact:email'] || null,
      brand: el.tags?.brand || null,
      openingHours: el.tags?.opening_hours || null,
      cuisine: el.tags?.cuisine || null,
      stars: el.tags?.stars ? parseInt(el.tags.stars) : null,
      source: 'openstreetmap',
      sourceId: `osm_${el.type}_${el.id}`,
      rawTags: el.tags || {},
    }));
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Overpass API request timed out');
    }
    throw err;
  }
}

function buildAddress(tags) {
  if (!tags) return null;
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
    tags['addr:country'],
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

module.exports = { search, getCountryCode, COUNTRY_CODES, BUSINESS_TAGS };
