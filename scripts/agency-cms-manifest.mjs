// Writes the Agency CMS content map for the Home page from the same field list the page renders from.
//   node scripts/agency-cms-manifest.mjs
import { writeFileSync } from 'node:fs';
import { buildHomeManifest } from '../src/lib/agencyCms/manifest.js';

const file = new URL('../docs/agency-cms-home-manifest.json', import.meta.url);
writeFileSync(file, `${JSON.stringify(buildHomeManifest(), null, 2)}\n`);
console.log(`Wrote ${file.pathname}`);
