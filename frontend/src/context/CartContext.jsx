import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const cartKey = emailId => `shopping_cart_${emailId}`;

function readCart(emailId) {
  try {
    return JSON.parse(localStorage.getItem(cartKey(emailId)) || '[]');
  } catch {
    return [];
  }
}

// Each account keeps its own cart, so logging out never shows it to the next user.
export function CartProvider({ children }) {
  const { user } = useAuth();
  const emailId = user?.emailId;
  const [items, setItems] = useState(() => (emailId ? readCart(emailId) : []));

  useEffect(() => {
    setItems(emailId ? readCart(emailId) : []);
  }, [emailId]);

  const save = useCallback(update => {
    setItems(current => {
      const next = update(current);
      if (emailId) localStorage.setItem(cartKey(emailId), JSON.stringify(next));
      return next;
    });
  }, [emailId]);

  const addItem = useCallback(product => save(current => {
    const existing = current.find(item => item.productId === product.productId);
    if (existing) {
      return current.map(item => (item === existing
        ? { ...item, qty: Math.min(item.qty + 1, product.quantity), stock: product.quantity }
        : item));
    }
    return [...current, {
      productId: product.productId,
      productName: product.productName,
      price: product.productPrice,
      stock: product.quantity,
      qty: 1
    }];
  }), [save]);

  const setQty = useCallback((productId, qty) => save(current => current.map(item => (
    item.productId === productId ? { ...item, qty: Math.min(Math.max(qty, 1), item.stock) } : item
  ))), [save]);

  const removeItem = useCallback(productId => {
    save(current => current.filter(item => item.productId !== productId));
  }, [save]);

  const clearCart = useCallback(() => save(() => []), [save]);

  const value = useMemo(() => ({
    items,
    addItem,
    setQty,
    removeItem,
    clearCart,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
    qtyInCart: productId => items.find(item => item.productId === productId)?.qty || 0
  }), [items, addItem, setQty, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
