import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { formatPrice } from '../formatPrice.js';

export default function Cart() {
  const { items, setQty, removeItem, clearCart, total } = useCart();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function placeOrder() {
    setBusy(true);
    clearNotice();
    try {
      const { message } = await api('/orders', {
        method: 'POST',
        body: { items: items.map(({ productId, qty }) => ({ productId, qty })) }
      });
      clearCart();
      showSuccess(message, { keep: true });
      navigate('/orders');
    } catch (error) {
      if (error.status !== 401) showError(error.message);
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <section className="catalog">
        <div className="section-heading"><div><span className="eyebrow">CART</span><h3>Your cart is empty</h3></div></div>
        <Link className="primary" to="/products">Browse products</Link>
      </section>
    );
  }

  return (
    <section className="catalog">
      <div className="section-heading"><div><span className="eyebrow">CART</span><h3>Your cart</h3></div></div>
      <div className="panel">
        {items.map(item => (
          <div className="cart-row" key={item.productId}>
            <div className="cart-name">
              <strong>{item.productName}</strong>
              <small>{formatPrice(item.price)} each</small>
            </div>
            <div className="qty">
              <button className="outline" aria-label={`Reduce ${item.productName} quantity`} disabled={item.qty <= 1} onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
              <span>{item.qty}</span>
              <button className="outline" aria-label={`Increase ${item.productName} quantity`} disabled={item.qty >= item.stock} onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
            </div>
            <strong className="line-total">{formatPrice(item.price * item.qty)}</strong>
            <button className="danger" onClick={() => removeItem(item.productId)}>Remove</button>
          </div>
        ))}
        <div className="cart-total">
          <span>Total <strong>{formatPrice(total)}</strong></span>
          <button className="primary" disabled={busy} onClick={placeOrder}>{busy ? 'Please wait…' : 'Place order'}</button>
        </div>
        <p className="muted">This is a demo checkout, so no payment is taken. Final prices are confirmed when you place the order.</p>
      </div>
    </section>
  );
}
