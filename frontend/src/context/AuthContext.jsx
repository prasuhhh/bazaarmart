import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler, TOKEN_KEY } from '../api/client.js';
import { useNotice } from './NoticeContext.jsx';

const USER_KEY = 'shopping_user';
const AuthContext = createContext(null);

function readStoredUser() {
  try {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [signedOut, setSignedOut] = useState(false);
  const { showError } = useNotice();

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const login = useCallback((token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setSignedOut(false);
  }, []);

  // A deliberate logout, unlike an expired session, shouldn't send the next
  // person who signs in back to the previous user's page.
  const logout = useCallback(() => {
    clearSession();
    setSignedOut(true);
  }, [clearSession]);

  const updateUser = useCallback(nextUser => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      showError('Session expired. Please sign in again.', { keep: true });
    });
  }, [clearSession, showError]);

  const value = useMemo(
    () => ({ user, signedOut, login, logout, updateUser }),
    [user, signedOut, login, logout, updateUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
