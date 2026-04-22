import crypto from 'crypto';

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value || !value.trim()) throw new Error(`Missing env var: ${key}`);
  return value.trim();
};

const getKey = () => {
  const b64 = getRequiredEnv('GOOGLE_DRIVE_TOKEN_ENC_KEY');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('GOOGLE_DRIVE_TOKEN_ENC_KEY must be 32 bytes (base64-encoded)');
  return key;
};

export function encryptRefreshToken(refreshToken) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Single-string payload for DB storage
  const payload = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64'),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptRefreshToken(encryptedPayload) {
  const key = getKey();
  const json = Buffer.from(encryptedPayload, 'base64').toString('utf8');
  const payload = JSON.parse(json);

  if (!payload?.iv || !payload?.tag || !payload?.ct) throw new Error('Invalid encrypted token payload');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ct, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
}

