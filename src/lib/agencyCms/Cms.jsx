import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { HOME_DEFAULTS, emphasisParts } from './fields.js';
import { connectHomePreview, loadHomeCopy, readCachedCopy, writeCachedCopy } from './feed.js';

// Both switches are off unless a build turns them on, so the live store behaves exactly as before until that is chosen.
const FEED_ON = import.meta.env.VITE_AGENCY_CMS_FEED === 'true';
const PREVIEW_ON = import.meta.env.VITE_AGENCY_CMS_PREVIEW === 'true';
const CMS_ORIGIN = import.meta.env.VITE_AGENCY_CMS_ORIGIN || 'https://app.ukaibuilds.com';

const CmsContext = createContext({ copy: HOME_DEFAULTS, preview: false });

/**
 * Supplies the Home text. It starts from the store's own text (or the last published copy this browser saw), then swaps in the
 * latest published text when the feed answers. It only ever changes strings: no element is added, removed or reordered by it.
 */
export function CmsProvider({ children }) {
  const [published, setPublished] = useState(() => (FEED_ON ? readCachedCopy() ?? {} : {}));
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (!FEED_ON) return undefined;
    const controller = new AbortController();
    void loadHomeCopy(CMS_ORIGIN, { signal: controller.signal }).then((feed) => {
      if (!feed || controller.signal.aborted) return;
      setPublished(feed.copy);
      writeCachedCopy(feed);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!PREVIEW_ON) return undefined;
    return connectHomePreview(CMS_ORIGIN, (fields) => setDraft(fields));
  }, []);

  const copy = useMemo(() => ({ ...HOME_DEFAULTS, ...published, ...(draft ?? {}) }), [published, draft]);
  const value = useMemo(() => ({ copy, preview: PREVIEW_ON }), [copy]);
  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCopy() {
  return useContext(CmsContext).copy;
}

/**
 * One piece of editable text. It renders the same element as the page always did. With `emphasis`, *starred* words become <em>.
 * The editor's click-to-edit marker is added only in an owner preview build, so visitors never get extra tab stops.
 */
export function Cms({ field, as: Tag = 'span', emphasis = false, ...rest }) {
  const { copy, preview } = useContext(CmsContext);
  const text = copy[field] ?? HOME_DEFAULTS[field] ?? '';
  const marker = preview ? { 'data-cms-field': field, tabIndex: 0 } : {};
  return (
    <Tag {...rest} {...marker}>
      {emphasis ? emphasisParts(text).map((part, i) => (part.em ? <em key={i}>{part.text}</em> : part.text)) : text}
    </Tag>
  );
}
