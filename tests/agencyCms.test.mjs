import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { connectHomePreview, homeFallback, loadHomeCopy, parseHomeFeed } from '../src/lib/agencyCms.js';

const feed = {
  format: 'agency-cms-content', formatVersion: 1, site: 'emblara-store', version: 1,
  pages: { home: { fields: {
    'tryon-eyebrow': { value: 'New label' },
    'tryon-sub': { value: 'New introduction' },
  } } },
};

describe('Emblara CMS Home copy', () => {
  it('loads only the expected published fields and falls back on unavailable or malformed feeds', async () => {
    const fetcher = async (_url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(feed) };
    };
    assert.deepEqual(await loadHomeCopy('https://agency-cms-ashen.vercel.app', { fetcher }), { eyebrow: 'New label', sub: 'New introduction' });
    assert.equal(parseHomeFeed({ ...feed, site: 'other-site' }), null);
    assert.equal(parseHomeFeed({ ...feed, pages: { home: { fields: { ...feed.pages.home.fields, 'tryon-sub': { value: 42 } } } } }), null);
    assert.deepEqual(await loadHomeCopy('https://agency-cms-ashen.vercel.app', { fetcher: async () => { throw new Error('offline'); } }), homeFallback);
    assert.deepEqual(await loadHomeCopy('http://agency-cms-ashen.vercel.app', { fetcher }), homeFallback);
  });

  it('accepts draft text only from the exact CMS parent and allows mapped field selection', () => {
    const handlers = new Map();
    const messages = [];
    const parent = { postMessage: (payload, origin) => messages.push({ payload, origin }) };
    const browser = { parent, addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: (name) => handlers.delete(name) };
    const documentRoot = { addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: (name) => handlers.delete(name) };
    const applied = [];
    const disconnect = connectHomePreview('https://agency-cms-ashen.vercel.app', (copy) => applied.push(copy), browser, documentRoot);
    const data = { kind: 'agency-cms-source-preview', site: 'emblara-store', page: 'home', nonce: 'fresh', fields: { 'tryon-eyebrow': 'Draft label', 'tryon-sub': 'Draft introduction' } };
    handlers.get('message')({ source: parent, origin: 'https://other.example', data });
    handlers.get('message')({ source: {}, origin: 'https://agency-cms-ashen.vercel.app', data });
    handlers.get('message')({ source: parent, origin: 'https://agency-cms-ashen.vercel.app', data: { ...data, fields: { ...data.fields, price: '£0' } } });
    handlers.get('message')({ source: parent, origin: 'https://agency-cms-ashen.vercel.app', data: { ...data, fields: { ...data.fields, 'tryon-sub': 'x'.repeat(5001) } } });
    assert.deepEqual(applied, []);
    handlers.get('message')({ source: parent, origin: 'https://agency-cms-ashen.vercel.app', data });
    assert.deepEqual(applied, [{ eyebrow: 'Draft label', sub: 'Draft introduction' }]);
    assert.equal(messages.at(-1).payload.kind, 'agency-cms-source-applied');
    let prevented = false;
    handlers.get('click')({ type: 'click', target: { closest: () => ({ dataset: { cmsField: 'tryon-sub' } }) }, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(messages.at(-1).payload.id, 'tryon-sub');
    disconnect();
    assert.equal(handlers.size, 0);
  });
});
