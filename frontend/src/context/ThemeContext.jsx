import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'bazaarmart_theme';
const ThemeContext = createContext(null);

// index.html sets this attribute before the first paint.
const currentTheme = () => document.documentElement.dataset.theme || 'day';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Saved only on a real choice, so anyone who never toggles keeps following their system.
  const toggleTheme = useCallback(() => {
    setTheme(current => {
      const next = current === 'night' ? 'day' : 'night';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // The theme still changes for this visit if storage is blocked.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
