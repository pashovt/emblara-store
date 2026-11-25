import { CMS_PAGE, HOME_FIELDS } from './fields.js';

/** The content map pasted into Agency CMS to create the editor's fields. It is built from the same list the page renders from. */
export function buildHomeManifest() {
  return {
    format: 'agency-cms-source',
    formatVersion: 1,
    pages: [
      {
        slug: CMS_PAGE,
        title: 'Home',
        fields: HOME_FIELDS.map(({ id, label, group, value }) => ({ id, label, group, type: 'text', value })),
      },
    ],
  };
}
