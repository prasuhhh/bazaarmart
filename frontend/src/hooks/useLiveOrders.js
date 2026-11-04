import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Reloads on every page change, so a new order shows up straight after checkout.
export function useLiveOrders() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return undefined;
    }
    let cancelled = false;
    api('/orders?status=live')
      .then(({ data }) => { if (!cancelled) setOrders(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, pathname]);

  return user ? orders : [];
}
