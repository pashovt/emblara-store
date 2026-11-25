// The Home page text that Agency CMS may replace. Each field's default is the text the store already shows, taken from the same
// source (site.js), so with the CMS off the page is exactly what it was. Nothing here touches products, prices, stock, delivery,
// checkout, quotes, privacy text or staff pages.
import { tryon, statement, process as steps } from '../../data/site.js';

export const CMS_SITE = 'emblara-store';
export const CMS_PAGE = 'home';
export const MAX_TEXT = 5000;

/** Words wrapped in *stars* are shown in the italic serif style. The stars are the only markup; everything else is plain text. */
export function statementToText(words) {
  let out = '';
  words.forEach(([word, serif], i) => {
    const prevSerif = i > 0 && words[i - 1][1];
    const nextSerif = i < words.length - 1 && words[i + 1][1];
    out += `${i ? ' ' : ''}${serif && !prevSerif ? '*' : ''}${word}${serif && !nextSerif ? '*' : ''}`;
  });
  return out;
}

const field = (id, label, group, value) => ({ id, label, group, value });

export const HOME_FIELDS = Object.freeze([
  field('tryon-eyebrow', 'Hero: small label above the headline', 'Try-on hero', tryon.eyebrow),
  ...tryon.lines.map((line, i) => field(`tryon-line-${i + 1}`, `Hero: headline, line ${i + 1}`, 'Try-on hero', line.text)),
  field('tryon-sub', 'Hero: introduction under the headline', 'Try-on hero', tryon.sub),
  field('promise-eyebrow', 'Promise: small label', 'Promise', 'The EMBLARA promise'),
  field('promise-statement', 'Promise: sentence (put *stars* round words to show them in italic serif)', 'Promise', statementToText(statement)),
  field('range-eyebrow', 'Range: small label above the heading', 'The range', 'The range'),
  field('range-title', 'Range: heading (put *stars* round words to emphasise them)', 'The range', 'Kit for *every* team.'),
  field('range-cta', 'Range: button under the heading', 'The range', 'View the full range'),
  field('quote-text', 'Quote: text (put *stars* round words to emphasise them)', 'Logos in place', 'Your logo, *placed* where you *approved* it. Every time.'),
  field('quote-footer', 'Quote: line under the quote', 'Logos in place', 'Every order gets a digital proof first'),
  field('process-eyebrow', 'How it works: small label above the heading', 'How it works', 'How it works'),
  field('process-title', 'How it works: heading (put *stars* round words to emphasise them)', 'How it works', 'From logo to *team kit*.'),
  ...steps.flatMap((step, i) => [
    field(`step-${i + 1}-title`, `How it works: step ${i + 1} title`, 'How it works', step.title),
    field(`step-${i + 1}-body`, `How it works: step ${i + 1} text`, 'How it works', step.body),
  ]),
  field('cta-title', 'Closing: heading (put *stars* round words to emphasise them)', 'Closing call to action', 'Send us *your* logo.'),
  field('cta-sub', 'Closing: text', 'Closing call to action', 'Add it at checkout or after you order. We prepare a free digital proof showing placement, size and colours. Nothing is made until you approve it.'),
  field('cta-button', 'Closing: button', 'Closing call to action', 'Build your kit'),
]);

export const HOME_FIELD_IDS = Object.freeze(HOME_FIELDS.map((item) => item.id));
export const HOME_DEFAULTS = Object.freeze(Object.fromEntries(HOME_FIELDS.map((item) => [item.id, item.value])));

/** Splits text into plain and emphasised parts. React renders them as text and <em>, so no HTML is ever accepted. */
export function emphasisParts(text) {
  const parts = [];
  let em = false;
  for (const chunk of String(text).split('*')) {
    if (chunk) parts.push({ text: chunk, em });
    em = !em;
  }
  return parts;
}

/** The promise sentence as [word, serif] pairs, the same shape the animated statement already uses. */
export function statementWords(text) {
  const words = [];
  let on = false;
  for (const token of String(text).trim().split(/\s+/)) {
    if (!token) continue;
    let word = token;
    let serif = on;
    if (word.startsWith('*')) { on = true; serif = true; word = word.slice(1); }
    if (word.endsWith('*')) { on = false; word = word.slice(0, -1); }
    word = word.replaceAll('*', '');
    if (word) words.push([word, serif]);
  }
  return words;
}

/** Plain text only: no control characters, a hard length limit, and never empty (empty keeps the default). */
export function cleanText(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return text.trim() && text.length <= MAX_TEXT ? text : null;
}
