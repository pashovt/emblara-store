import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { statement } from '../src/data/site.js';
import { HOME_DEFAULTS, HOME_FIELDS, HOME_FIELD_IDS, cleanText, emphasisParts, statementToText, statementWords } from '../src/lib/agencyCms/fields.js';
import { CACHE_KEY, connectHomePreview, loadHomeCopy, parseHomeFeed, pickKnownFields, readCachedCopy, writeCachedCopy } from '../src/lib/agencyCms/feed.js';
import { buildHomeManifest } from '../src/lib/agencyCms/manifest.js';

const fieldsFor = (overrides = {}) => Object.fromEntries(HOME_FIELD_IDS.map((id) => [id, { label: id, type: 'text', value: overrides[id] ?? HOME_DEFAULTS[id] }]));
const feed = (overrides = {}, extra = {}) => ({ format: 'agency-cms-content', formatVersion: 1, site: 'emblara-store', version: 3, pages: { home: { title: 'Home', fields: fieldsFor(overrides) } }, ...extra });

describe('Home field list', () => {
  it('uses ids, labels and sizes the CMS accepts, with no duplicates', () => {
    assert.equal(new Set(HOME_FIELD_IDS).size, HOME_FIELD_IDS.length);
    assert.equal(new Set(HOME_FIELDS.map((f) => f.label)).size, HOME_FIELDS.length, 'every label is unique so editors can tell fields apart');
    assert.ok(HOME_FIELDS.length >= 20 && HOME_FIELDS.length <= 100);
    for (const f of HOME_FIELDS) {
      assert.match(f.id, /^[a-z][a-z0-9-]{1,79}$/);
      assert.ok(f.label.length >= 1 && f.label.length <= 100, f.id);
      assert.ok(f.group.length >= 1 && f.group.length <= 80, f.id);
      assert.ok(f.value.length >= 1 && f.value.length <= 5000, f.id);
    }
  });

  it('reproduces the original animated statement exactly from its default text', () => {
    assert.deepEqual(statementWords(HOME_DEFAULTS['promise-statement']), statement);
    assert.deepEqual(statementWords(statementToText(statement)), statement);
  });

  it('keeps the original emphasis markup for headings', () => {
    assert.deepEqual(emphasisParts(HOME_DEFAULTS['range-title']), [{ text: 'Kit for ', em: false }, { text: 'every', em: true }, { text: ' team.', em: false }]);
    assert.deepEqual(emphasisParts('Plain text'), [{ text: 'Plain text', em: false }]);
    assert.deepEqual(emphasisParts('Ends *open'), [{ text: 'Ends ', em: false }, { text: 'open', em: true }]);
  });

  it('turns edited promise text into words with the same shape the animation uses', () => {
    assert.deepEqual(statementWords('One *two three* four'), [['One', false], ['two', true], ['three', true], ['four', false]]);
    assert.deepEqual(statementWords('  spaced   out  '), [['spaced', false], ['out', false]]);
  });

  it('accepts only plain, bounded, non-empty text', () => {
    assert.equal(cleanText('Fine'), 'Fine');
    assert.equal(cleanText('   '), null);
    assert.equal(cleanText(42), null);
    assert.equal(cleanText('x'.repeat(5001)), null);
    assert.equal(cleanText('a\u0000b'), 'ab');
  });

  it('matches the content map file that is pasted into the CMS', () => {
    const onDisk = JSON.parse(readFileSync(new URL('../docs/agency-cms-home-manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(onDisk, buildHomeManifest());
  });
});

describe('Published feed', () => {
  it('reads only known fields and lets a bad or missing field fall back on its own', () => {
    const parsed = parseHomeFeed(feed({ 'tryon-eyebrow': 'New label', 'range-cta': '' }));
    assert.equal(parsed.version, 3);
    assert.equal(parsed.copy['tryon-eyebrow'], 'New label');
    assert.equal(parsed.copy['range-cta'], undefined);
    assert.equal(parsed.copy['tryon-sub'], HOME_DEFAULTS['tryon-sub']);
    const withBad = feed();
    withBad.pages.home.fields['tryon-sub'].value = 42;
    withBad.pages.home.fields.unknown = { value: 'ignored' };
    const bad = parseHomeFeed(withBad);
    assert.equal(bad.copy['tryon-sub'], undefined);
    assert.equal(bad.copy.unknown, undefined);
  });

  it('rejects the wrong site, format, version or shape', () => {
    assert.equal(parseHomeFeed(feed({}, { site: 'other-site' })), null);
    assert.equal(parseHomeFeed(feed({}, { formatVersion: 2 })), null);
    assert.equal(parseHomeFeed(feed({}, { version: -1 })), null);
    assert.equal(parseHomeFeed({ ...feed(), pages: {} }), null);
    assert.equal(parseHomeFeed(null), null);
  });

  it('fetches without cookies or redirects and returns null whenever the feed is unavailable', async () => {
    const ok = async (url, options) => {
      assert.equal(url, 'https://app.ukaibuilds.com/api/site-content/emblara-store');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(feed({ 'tryon-sub': 'Changed' })) };
    };
    assert.equal((await loadHomeCopy('https://app.ukaibuilds.com', { fetcher: ok })).copy['tryon-sub'], 'Changed');
    assert.equal(await loadHomeCopy('https://app.ukaibuilds.com', { fetcher: async () => { throw new Error('offline'); } }), null);
    assert.equal(await loadHomeCopy('https://app.ukaibuilds.com', { fetcher: async () => ({ ok: false, headers: new Headers() }) }), null);
    assert.equal(await loadHomeCopy('https://app.ukaibuilds.com', { fetcher: async () => ({ ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<p>x</p>' }) }), null);
    assert.equal(await loadHomeCopy('https://app.ukaibuilds.com', { fetcher: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), text: async () => 'x'.repeat(300_000) }) }), null);
    assert.equal(await loadHomeCopy('http://app.ukaibuilds.com', { fetcher: ok }), null);
    assert.equal(await loadHomeCopy('https://app.ukaibuilds.com/path', { fetcher: ok }), null);
  });

  it('allows plain http only for the visitor\'s own machine, and never for another host', async () => {
    let asked = '';
    const fetcher = async (url) => { asked = url; return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify(feed()) }; };
    assert.ok(await loadHomeCopy('http://localhost:3100', { fetcher }));
    assert.equal(asked, 'http://localhost:3100/api/site-content/emblara-store');
    assert.ok(await loadHomeCopy('http://127.0.0.1:3100', { fetcher }));
    assert.equal(await loadHomeCopy('http://example.com', { fetcher }), null);
    assert.equal(await loadHomeCopy('http://localhost.evil.example', { fetcher }), null);
  });

  it('remembers the last good copy and ignores a damaged cache', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(readCachedCopy(storage), null);
    writeCachedCopy({ version: 2, copy: { 'tryon-sub': 'Saved' } }, storage);
    assert.deepEqual(readCachedCopy(storage), { 'tryon-sub': 'Saved' });
    store.set(CACHE_KEY, '{not json');
    assert.equal(readCachedCopy(storage), null);
    store.set(CACHE_KEY, JSON.stringify({ version: 1, copy: { 'tryon-sub': 7, nope: 'x' } }));
    assert.deepEqual(readCachedCopy(storage), {});
    assert.deepEqual(pickKnownFields({ nope: 'x' }), {});
  });
});

describe('Owner draft preview', () => {
  function frame() {
    const handlers = new Map();
    const messages = [];
    const parent = { postMessage: (payload, origin) => messages.push({ payload, origin }) };
    const browser = { parent, addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener: (type) => handlers.delete(type) };
    const doc = { addEventListener: (type, fn) => handlers.set(`doc:${type}`, fn), removeEventListener: (type) => handlers.delete(`doc:${type}`) };
    return { handlers, messages, parent, browser, doc };
  }
  const message = (parent, extra = {}) => ({ source: parent, origin: 'https://app.ukaibuilds.com', data: { kind: 'agency-cms-source-preview', site: 'emblara-store', page: 'home', nonce: 'n1', fields: { 'tryon-sub': 'Draft' }, ...extra } });

  it('applies draft text only from the exact CMS parent, for known fields, and confirms it', () => {
    const f = frame();
    const applied = [];
    const stop = connectHomePreview('https://app.ukaibuilds.com', (fields) => applied.push(fields), f.browser, f.doc);
    assert.deepEqual(f.messages[0], { payload: { kind: 'agency-cms-source-ready', site: 'emblara-store', page: 'home' }, origin: 'https://app.ukaibuilds.com' });
    const receive = f.handlers.get('message');
    receive({ ...message(f.parent), origin: 'https://evil.example' });
    receive({ ...message(f.parent), source: {} });
    receive(message(f.parent, { site: 'other' }));
    receive(message(f.parent, { page: 'shop' }));
    receive(message(f.parent, { fields: { 'unknown-field': 'x' } }));
    receive(message(f.parent, { fields: {} }));
    receive(message(f.parent, { nonce: '' }));
    assert.equal(applied.length, 0);
    receive(message(f.parent));
    assert.deepEqual(applied, [{ 'tryon-sub': 'Draft' }]);
    assert.deepEqual(f.messages.at(-1), { payload: { kind: 'agency-cms-source-applied', site: 'emblara-store', page: 'home', nonce: 'n1' }, origin: 'https://app.ukaibuilds.com' });
    stop();
    assert.equal(f.handlers.size, 0);
  });

  it('reports a click on a mapped element only after a draft was received', () => {
    const f = frame();
    connectHomePreview('https://app.ukaibuilds.com', () => {}, f.browser, f.doc);
    const click = f.handlers.get('doc:click');
    const target = (id) => ({ closest: () => ({ dataset: { cmsField: id } }) });
    click({ type: 'click', target: target('tryon-sub'), preventDefault() {} });
    assert.equal(f.messages.length, 1);
    f.handlers.get('message')(message(f.parent));
    click({ type: 'click', target: target('not-a-field'), preventDefault() {} });
    click({ type: 'click', target: target('tryon-sub'), preventDefault() {} });
    assert.deepEqual(f.messages.at(-1).payload, { kind: 'agency-cms-source-select', site: 'emblara-store', page: 'home', id: 'tryon-sub', nonce: 'n1' });
  });

  it('does nothing outside a frame or with a non-HTTPS CMS origin', () => {
    const f = frame();
    f.browser.parent = f.browser;
    connectHomePreview('https://app.ukaibuilds.com', () => {}, f.browser, f.doc);
    assert.equal(f.handlers.size, 0);
    const g = frame();
    connectHomePreview('http://app.ukaibuilds.com', () => {}, g.browser, g.doc);
    assert.equal(g.handlers.size, 0);
  });
});
