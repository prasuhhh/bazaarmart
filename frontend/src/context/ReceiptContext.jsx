import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const GUEST_KEY = 'bazaarmart_receipt_guest';
const ReceiptContext = createContext(null);
const SYNC_DELAY_MS = 400;
const userKey = owner => `bazaarmart_receipt_${owner}`;
const dirtyKey = key => `${key}_dirty`;

// Two colours of a product are two lines, so each colour gets its own id.
export const lineIdOf = line => (line.colour ? `${line.productId}:${line.colour}` : line.productId);

// Receipts saved before images moved to /products still hold an old photo link.
const withCurrentImage = line => (line.image?.includes('picsum.photos')
  ? { ...line, image: `/products/${line.productId}.svg` }
  : line);

function readLines(key) {
  try {
    const lines = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(lines) ? lines.map(withCurrentImage) : [];
  } catch {
    return [];
  }
}

function writeLines(key, lines) {
  try {
    localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    // The receipt still works for this visit if storage is blocked.
  }
}

// Dirty means this browser holds a change the server hasn't got yet, so that
// change survives a reload or a failed save instead of being replaced.
function isDirty(key) {
  try {
    return localStorage.getItem(dirtyKey(key)) === 'true';
  } catch {
    return false;
  }
}

function setDirty(key, value) {
  try {
    if (value) localStorage.setItem(dirtyKey(key), 'true');
    else localStorage.removeItem(dirtyKey(key));
  } catch {
    // Without storage the next save still sends the receipt.
  }
}

function mergeLines(base, incoming) {
  const merged = base.map(line => ({ ...line }));
  for (const line of incoming) {
    const match = merged.find(entry => lineIdOf(entry) === lineIdOf(line));
    if (match) match.qty = Math.min(match.qty + line.qty, Math.max(match.stock, line.stock));
    else merged.push(line);
  }
  return merged;
}

const toLine = (product, colour = product.colours?.[0]) => ({
  productId: product.productId,
  colour,
  productName: product.productName,
  price: product.productPrice,
  stock: product.quantity,
  image: product.images?.[0],
  qty: 1
});

// Guests keep a receipt in this browser. For an account the server holds the receipt,
// so it follows them between devices, and anything added as a guest joins it at sign-in.
export function ReceiptProvider({ children }) {
  const { user } = useAuth();
  // A phone account can add an email later, so the phone comes first to keep the key stable.
  const owner = user?.phone ?? user?.emailId ?? null;
  const storageKey = owner ? userKey(owner) : GUEST_KEY;
  const keyRef = useRef(storageKey);
  const [items, setItems] = useState(() => readLines(storageKey));
  const [isOpen, setIsOpen] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    keyRef.current = storageKey;
    setIsSynced(false);
    if (!owner) {
      setItems(readLines(GUEST_KEY));
      return undefined;
    }

    // Shows this browser's copy at once, then replaces it with the server's.
    const guestLines = readLines(GUEST_KEY);
    const cached = mergeLines(readLines(storageKey), guestLines);
    writeLines(storageKey, cached);
    writeLines(GUEST_KEY, []);
    setItems(cached);

    let cancelled = false;
    api('/users/me/receipt')
      .then(({ data }) => {
        if (cancelled) return;
        // Never synced means an older browser receipt, which the account should adopt.
        const keepLocal = isDirty(storageKey) || !data.syncedAt;
        const lines = keepLocal ? readLines(storageKey) : mergeLines(data.lines, guestLines);
        writeLines(storageKey, lines);
        setItems(lines);
        setIsSynced(true);
      })
      .catch(() => { if (guestLines.length) setDirty(storageKey, true); });
    return () => { cancelled = true; };
  }, [owner, storageKey]);

  useEffect(() => {
    if (!owner || !isSynced) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api('/users/me/receipt', {
        method: 'PUT',
        body: { items: items.map(({ productId, colour, qty }) => ({ productId, colour, qty })) }
      })
        .then(() => { if (!cancelled) setDirty(storageKey, false); })
        .catch(() => {});
    }, SYNC_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [items, owner, storageKey, isSynced]);

  const update = useCallback(change => {
    setItems(current => {
      const next = change(current);
      writeLines(keyRef.current, next);
      if (keyRef.current !== GUEST_KEY) setDirty(keyRef.current, true);
      return next;
    });
  }, []);

  const addItem = useCallback((product, colour) => {
    update(current => mergeLines(current, [toLine(product, colour)]));
  }, [update]);

  const setQty = useCallback((lineId, qty) => update(current => current.map(line => (
    lineIdOf(line) === lineId ? { ...line, qty: Math.min(Math.max(qty, 1), line.stock) } : line
  ))), [update]);

  const removeItem = useCallback(lineId => {
    update(current => current.filter(line => lineIdOf(line) !== lineId));
  }, [update]);

  const clearReceipt = useCallback(() => update(() => []), [update]);
  const openReceipt = useCallback(() => setIsOpen(true), []);
  const closeReceipt = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({
    items,
    isOpen,
    addItem,
    setQty,
    removeItem,
    clearReceipt,
    openReceipt,
    closeReceipt,
    lineCount: items.length,
    subtotal: items.reduce((sum, line) => sum + line.qty * line.price, 0),
    qtyOf: productId => items.reduce((sum, line) => sum + (line.productId === productId ? line.qty : 0), 0)
  }), [items, isOpen, addItem, setQty, removeItem, clearReceipt, openReceipt, closeReceipt]);

  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
}

export const useReceipt = () => useContext(ReceiptContext);
