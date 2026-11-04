import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const NoticeContext = createContext(null);
const VISIBLE_MS = { success: 5000, info: 5000, error: 8000 };

export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const { pathname } = useLocation();

  // Notices clear on navigation. `keep` lets one survive a single redirect.
  useEffect(() => {
    setNotice(current => (current?.keep ? { ...current, keep: false } : null));
  }, [pathname]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), VISIBLE_MS[notice.type]);
    return () => clearTimeout(timer);
  }, [notice]);

  const showSuccess = useCallback((text, options) => setNotice({ text, type: 'success', ...options }), []);
  const showError = useCallback((text, options) => setNotice({ text, type: 'error', ...options }), []);
  const showInfo = useCallback((text, options) => setNotice({ text, type: 'info', ...options }), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({ notice, showSuccess, showError, showInfo, clearNotice }),
    [notice, showSuccess, showError, showInfo, clearNotice]
  );
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export const useNotice = () => useContext(NoticeContext);
