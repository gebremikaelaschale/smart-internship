const crypto = require('crypto');

function getKey() {
  const secret = String(
    process.env.SIGNATURE_SECRET
      || process.env.JWT_SECRET
      || process.env.MONGO_URI
      || 'smart-internship-signature-secret'
  );
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSignatureDataUrl(dataUrl = '') {
  const plain = String(dataUrl || '').trim();
  if (!plain) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

function decryptSignatureDataUrl(payload = {}) {
  const cipherText = String(payload?.cipherText || '').trim();
  const iv = String(payload?.iv || '').trim();
  const tag = String(payload?.tag || '').trim();

  if (!cipherText || !iv || !tag) return '';

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getKey(),
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherText, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

module.exports = {
  encryptSignatureDataUrl,
  decryptSignatureDataUrl
};
