import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cleanLogo } from '../lib/logo-clean.js';

// Which logo the garments show: the EMBLARA mark (default) or the visitor's own.
// The visitor's logo is kept in this browser's storage (localStorage), so it is
// still there when they come back. Cookies cap out at about 4 KB, too small for
// an image, so storage plays the same role here. Nothing is uploaded.
const KEY = 'emblara-logo-v1';
const LogoContext = createContext(null);

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw?.custom?.src) return { mode: raw.mode === 'custom' ? 'custom' : 'emblara', custom: raw.custom };
  } catch {
    /* unreadable: start fresh */
  }
  return { mode: 'emblara', custom: null };
};

const hexLum = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

export function LogoProvider({ children }) {
  const [state, setState] = useState(load);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saved, setSaved] = useState(true);

  // Save on every change. Storage can be full or blocked; the logo then
  // still works until the tab closes.
  const commit = useCallback((next) => {
    setState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, []);

  const setFromFile = useCallback(async (file) => {
    const custom = await cleanLogo(file);
    commit({ mode: 'custom', custom });
    return custom;
  }, [commit]);

  const choose = useCallback(
    (mode) => commit({ ...state, mode: mode === 'custom' && state.custom ? 'custom' : 'emblara' }),
    [commit, state],
  );
  const remove = useCallback(() => commit({ mode: 'emblara', custom: null }), [commit]);

  // How to draw the logo on a garment of a given colour.
  const artFor = useCallback(
    (garmentHex) => {
      const darkGarment = hexLum(garmentHex) < 0.45;
      if (state.mode !== 'custom' || !state.custom) return { kind: 'emblara', darkGarment };
      const c = state.custom;
      let src = c.src;
      if (darkGarment && c.tone < 0.35) src = c.light;
      else if (!darkGarment && c.tone > 0.78) src = c.dark;
      return { kind: 'custom', src, darkGarment, name: c.name };
    },
    [state],
  );

  const value = useMemo(
    () => ({ ...state, saved, setFromFile, choose, remove, artFor, panelOpen, setPanelOpen }),
    [state, saved, setFromFile, choose, remove, artFor, panelOpen],
  );
  return <LogoContext.Provider value={value}>{children}</LogoContext.Provider>;
}

export const useLogo = () => useContext(LogoContext);
