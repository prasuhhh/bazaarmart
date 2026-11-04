import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useDebounce } from './useDebounce.js';

const QUOTE_DELAY_MS = 250;

// The server prices the receipt, so what the Pay button shows is what gets charged.
export function useQuote(items, coupon) {
  const request = useMemo(() => JSON.stringify({
    items: items.map(({ productId, colour, qty }) => ({ productId, colour, qty })),
    coupon: coupon || undefined
  }), [items, coupon]);
  const settled = useDebounce(request, QUOTE_DELAY_MS);
  const [result, setResult] = useState({ request: null, quote: null, error: null });
  const [version, setVersion] = useState(0);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!hasItems) return undefined;
    let cancelled = false;
    api('/orders/quote', { method: 'POST', body: JSON.parse(settled) })
      .then(({ data }) => { if (!cancelled) setResult({ request: settled, quote: data, error: null }); })
      .catch(error => { if (!cancelled) setResult(current => ({ ...current, request: settled, error })); });
    return () => { cancelled = true; };
  }, [settled, hasItems, version]);

  const reload = useCallback(() => setVersion(current => current + 1), []);
  return {
    quote: result.quote,
    error: result.error,
    isReady: result.request === request && !result.error,
    reload
  };
}
