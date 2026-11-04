import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const GUEST_KEY = 'bazaarmart_receipt_guest';
const ReceiptContext = createContext(null);
const userKey = owner => `bazaarmart_receipt_${owner}`;

function readLines(key) {
  try {
    const lines = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(lines) ? lines : [];
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

function mergeLines(base, incoming) {
  const merged = base.map(line => ({ ...line }));
  for (const line of incoming) {
    const match = merged.find(entry => entry.productId === line.productId);
    if (match) match.qty = Math.min(match.qty + line.qty, Math.max(match.stock, line.stock));
    else merged.push(line);
  }
  return merged;
}

const toLine = product => ({
  productId: product.productId,
  productName: product.productName,
  price: product.productPrice,
  stock: product.quantity,
  image: product.images?.[0],
  qty: 1
});

// Each account keeps its own receipt. Anything added as a guest joins it at sign-in.
export function ReceiptProvider({ children }) {
  const { user } = useAuth();
  const owner = user?.emailId ?? user?.phone ?? null;
  const storageKey = owner ? userKey(owner) : GUEST_KEY;
  const keyRef = useRef(storageKey);
  const [items, setItems] = useState(() => readLines(storageKey));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    keyRef.current = storageKey;
    if (!owner) {
      setItems(readLines(GUEST_KEY));
      return;
    }
    const merged = mergeLines(readLines(storageKey), readLines(GUEST_KEY));
    writeLines(storageKey, merged);
    writeLines(GUEST_KEY, []);
    setItems(merged);
  }, [owner, storageKey]);

  const update = useCallback(change => {
    setItems(current => {
      const next = change(current);
      writeLines(keyRef.current, next);
      return next;
    });
  }, []);

  const addItem = useCallback(product => update(current => mergeLines(current, [toLine(product)])), [update]);

  const setQty = useCallback((productId, qty) => update(current => current.map(line => (
    line.productId === productId ? { ...line, qty: Math.min(Math.max(qty, 1), line.stock) } : line
  ))), [update]);

  const removeItem = useCallback(productId => {
    update(current => current.filter(line => line.productId !== productId));
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
    qtyOf: productId => items.find(line => line.productId === productId)?.qty ?? 0
  }), [items, isOpen, addItem, setQty, removeItem, clearReceipt, openReceipt, closeReceipt]);

  return <ReceiptContext.Provider value={value}>{children}</ReceiptContext.Provider>;
}

export const useReceipt = () => useContext(ReceiptContext);
