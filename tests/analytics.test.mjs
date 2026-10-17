// Analytics helpers: route paths sent to GA and consent parsing. No browser, no network.
//   npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanLocation, parseConsent, routePath } from '../src/lib/analytics.js';

describe('routePath', () => {
  it('maps hash routes to clean paths', () => {
    assert.equal(routePath(''), '/');
    assert.equal(routePath('#'), '/');
    assert.equal(routePath('#/'), '/');
    assert.equal(routePath('#/shop'), '/shop');
    assert.equal(routePath('#/shop/polos'), '/shop/polos');
    assert.equal(routePath('#/product/logo-clean-up'), '/product/logo-clean-up');
    assert.equal(routePath('#/shop/'), '/shop');
  });

  it('never carries a query string', () => {
    assert.equal(routePath('#/order-success?session_id=cs_test_abc'), '/order-success');
  });
});

describe('cleanLocation', () => {
  it('is origin plus route, so a Stripe return query never reaches GA', () => {
    assert.equal(cleanLocation('https://emblara.co.uk', '#/order-success'), 'https://emblara.co.uk/order-success');
    assert.equal(cleanLocation('https://emblara.co.uk', ''), 'https://emblara.co.uk/');
  });
});

describe('parseConsent', () => {
  it('accepts only the two stored values', () => {
    assert.equal(parseConsent('granted'), 'granted');
    assert.equal(parseConsent('denied'), 'denied');
    assert.equal(parseConsent('yes'), null);
    assert.equal(parseConsent(null), null);
    assert.equal(parseConsent(undefined), null);
  });
});
