import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { formatPrice } from '../formatPrice.js';

const EMPTY_ADDRESS = { name: '', phone: '', line1: '', city: '', state: '', pincode: '' };
const SLOTS = ['Today 6–9 pm', 'Tomorrow'];
const PAYMENT_METHODS = [['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking'], ['cod', 'Cash on delivery']];

export default function Cart() {
  const { items, setQty, removeItem, clearCart, total } = useCart();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  useEffect(() => {
    api('/users/me/addresses')
      .then(({ data }) => {
        const saved = data.find(entry => entry.isDefault);
        if (saved) setAddress(current => ({ ...current, ...saved }));
      })
      .catch(() => {});
  }, []);

  const updateAddress = field => event => setAddress(current => ({ ...current, [field]: event.target.value }));

  async function placeOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    clearNotice();
    try {
      const { message } = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map(({ productId, qty }) => ({ productId, qty })),
          address,
          slot: { label: form.get('slot') },
          payment: { method: form.get('payment') }
        }
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
        <div className="cart-total"><span>Subtotal <strong>{formatPrice(total)}</strong></span></div>
      </div>

      <form className="panel form-grid" aria-label="Delivery details" onSubmit={placeOrder}>
        <label>Name<input name="name" value={address.name} onChange={updateAddress('name')} required /></label>
        <label>Phone<input name="phone" value={address.phone} onChange={updateAddress('phone')} required /></label>
        <label className="full">Address<input name="line1" value={address.line1} onChange={updateAddress('line1')} required /></label>
        <label>City<input name="city" value={address.city} onChange={updateAddress('city')} required /></label>
        <label>State<input name="state" value={address.state} onChange={updateAddress('state')} required /></label>
        <label>Pincode<input name="pincode" value={address.pincode} onChange={updateAddress('pincode')} inputMode="numeric" required /></label>
        <label>Delivery slot
          <select name="slot">{SLOTS.map(slot => <option key={slot}>{slot}</option>)}</select>
        </label>
        <label>Payment
          <select name="payment">{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <div className="form-footer full">
          <button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Place order'}</button>
        </div>
        <p className="muted full">This is a demo checkout, so no payment is taken. Orders under ₹999 add ₹49 delivery, and the final total is confirmed when you place the order.</p>
      </form>
    </section>
  );
}
