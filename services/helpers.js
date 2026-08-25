function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function now() {
  return new Date().toISOString();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(llc|ltd|inc|corp|co|gmbh|ag|pte|sdn|bhd|有限公司|有限责任公司)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

module.exports = { genId, now, pick, normalizeCompanyName, extractDomain };
