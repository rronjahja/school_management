import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const read = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sessionStorage e mbushur ose e bllokuar: gjendja thjeshte nuk ruhet */
  }
};

export function useStickyState(key, initial) {
  const storageKey = `ispe:${key}`;
  const [value, setValue] = useState(() => read(storageKey, initial));

  useEffect(() => { write(storageKey, value); }, [storageKey, value]);

  return [value, setValue];
}

export function useScrollRestore(key, ready = true) {
  const { pathname } = useLocation();
  const storageKey = `ispe:scroll:${key || pathname}`;
  const restored = useRef(false);

  useEffect(() => {
    const save = () => write(storageKey, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    // Pa ruajtje ne pastrim: nen StrictMode pastrimi vjen para se te
    // rivendoset pozicioni, dhe do te shkruante 0 mbi vleren e ruajtur.
    // Degjuesi i mesiperm e ka ruajtur tashme cdo levizje te vertete.
    return () => window.removeEventListener('scroll', save);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || restored.current) return;
    const y = read(storageKey, 0);
    if (!y) { restored.current = true; return; }

    restored.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }, [storageKey, ready]);
}

export function useClearPageState() {
  return useCallback((prefix) => {
    try {
      const doomed = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`ispe:${prefix}`)) doomed.push(k);
      }
      doomed.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* pa rendesi */
    }
  }, []);
}