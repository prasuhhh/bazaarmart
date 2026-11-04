import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const NoticeContext = createContext(null);

export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const { pathname } = useLocation();

  // Notices clear on navigation. `keep` lets one survive a single redirect.
  useEffect(() => {
    setNotice(current => (current?.keep ? { ...current, keep: false } : null));
  }, [pathname]);

  const showSuccess = useCallback((text, options) => setNotice({ text, type: 'success', ...options }), []);
  const showError = useCallback((text, options) => setNotice({ text, type: 'error', ...options }), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({ notice, showSuccess, showError, clearNotice }),
    [notice, showSuccess, showError, clearNotice]
  );
  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export const useNotice = () => useContext(NoticeContext);
