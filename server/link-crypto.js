import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HttpError } from './http.js';

const key = () => {
  const value = Buffer.from(process.env.LINK_ENCRYPTION_KEY ?? '', 'base64');
  if (value.length !== 32) throw new HttpError(503, 'Private quote links are not configured.');
  return value;
};
export const newToken = () => randomBytes(32).toString('base64url');
export function encryptLink(value) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.'); }
export function decryptLink(value) { const [iv, tag, encrypted] = String(value).split('.').map((part) => Buffer.from(part, 'base64url')); if (!iv || !tag || !encrypted) throw new Error('invalid link'); const cipher = createDecipheriv('aes-256-gcm', key(), iv); cipher.setAuthTag(tag); return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8'); }
