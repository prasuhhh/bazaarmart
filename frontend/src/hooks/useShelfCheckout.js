import { useCallback, useMemo, useState } from 'react';
import { useFetch } from './useFetch.js';

const checkoutPath = ({ shelfId, shareId }) => {
  if (shelfId) return `/shelves/${encodeURIComponent(shelfId)}/checkout`;
  return shareId ? `/shelves/shared/${encodeURIComponent(shareId)}/checkout` : null;
};

// The shelf's lines for the counter, with the buyer's quantities and ticks kept beside
// them. It holds its own state on purpose: a shelf order never touches the receipt.
export function useShelfCheckout(shelf) {
  const { data, error } = useFetch(checkoutPath(shelf));
  const [picks, setPicks] = useState({});

  const lines = useMemo(() => data?.lines.map(line => ({
    ...line,
    qty: Math.min(picks[line.productId]?.qty ?? 1, Math.max(line.stock, 1)),
    isChecked: line.inStock && (picks[line.productId]?.isChecked ?? true)
  })) ?? null, [data, picks]);

  const items = useMemo(() => (lines ?? [])
    .filter(line => line.isChecked)
    .map(({ productId, name, price, qty }) => ({ productId, productName: name, price, qty })), [lines]);

  const pick = useCallback((productId, changes) => {
    setPicks(current => ({ ...current, [productId]: { ...current[productId], ...changes } }));
  }, []);

  const setAllQty = useCallback(qty => {
    setPicks(current => Object.fromEntries(data.lines.map(({ productId }) => [productId, { ...current[productId], qty }])));
  }, [data]);

  return { shelfName: data?.shelfName, lines, items, error, pick, setAllQty };
}
