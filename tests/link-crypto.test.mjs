import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const { decryptLink, encryptLink, newToken } = await import('../server/link-crypto.js');

test('private quote links encrypt and decrypt without retaining their plaintext', () => {
  const link = `https://emblara.co.uk/#/q/${newToken()}`;
  const encrypted = encryptLink(link);
  assert.notEqual(encrypted, link);
  assert.ok(!encrypted.includes(link));
  assert.equal(decryptLink(encrypted), link);
});

test('each private-link token is a distinct URL-safe value', () => {
  const tokens = new Set(Array.from({ length: 20 }, () => newToken()));
  assert.equal(tokens.size, 20);
  assert.ok([...tokens].every((token) => /^[A-Za-z0-9_-]{43}$/.test(token)));
});
