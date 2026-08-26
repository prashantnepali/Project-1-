const { extractDomain } = require('./helpers');

function normalize(rawResult) {
  const normalized = {
    name: cleanName(rawResult.name),
    normalizedName: normalizeName(rawResult.name),
    category: rawResult.category || null,
    industry: rawResult.industry || null,
    country: rawResult.country || null,
    city: rawResult.city || null,
    address: rawResult.address || null,
    latitude: rawResult.latitude != null ? rawResult.latitude : null,
    longitude: rawResult.longitude != null ? rawResult.longitude : null,
    website: normalizeUrl(rawResult.website),
    phone: normalizePhone(rawResult.phone),
    email: rawResult.email || null,
    brand: rawResult.brand || null,
    source: rawResult.source || 'openstreetmap',
    sourceId: rawResult.sourceId || null,
    domain: extractDomain(rawResult.website),
  };

  return normalized;
}

function cleanName(name) {
  if (!name) return null;
  return name
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9'\s\u4e00-\u9fff]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/\b(llc|ltd|inc|corp|co|gmbh|ag|pte|sdn|bhd|有限公司|有限责任公司)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  try {
    let u = url.trim();
    if (!u.startsWith('http')) u = `https://${u}`;
    const parsed = new URL(u);
    let normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '');
    return normalized;
  } catch {
    return null;
  }
}

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.length < 7) return null;
  return cleaned;
}

module.exports = { normalize, cleanName, normalizeName, normalizeUrl, normalizePhone };
