function normalizeString(value) {
  if (value === null || typeof value === 'undefined') return '';
  try {
    return String(value).trim().toLowerCase();
  } catch (e) {
    return '';
  }
}

module.exports = { normalizeString };
