const crypto = require('crypto');

function genId() {
  const rand = crypto.randomBytes(12).toString('base64url');
  const time = Date.now().toString(36);
  return rand + time;
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
    .replace(/[^a-z0-9\s\u4e00-\u9fff]/g, '')
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
