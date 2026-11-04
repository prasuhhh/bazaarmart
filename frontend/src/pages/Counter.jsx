import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Stepper from '../components/ui/Stepper.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';
import { formatPrice } from '../formatPrice.js';
import Placeholder from './Placeholder.jsx';

const EMPTY_ADDRESS = { name: '', phone: '', line1: '', city: '', state: '', pincode: '' };
const SLOTS = ['Today 6–9 pm', 'Tomorrow'];
const PAYMENT_METHODS = [['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking'], ['cod', 'Cash on delivery']];

// A simple form that keeps checkout working until the three-step Counter is built.
export default function Counter() {
  const { user } = useAuth();
  const { items, setQty, removeItem, clearReceipt, subtotal } = useReceipt();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState(EMPTY_ADDRESS);

  useEffect(() => {
    if (!user) return;
    api('/users/me/addresses')
      .then(({ data }) => {
        const saved = data.find(entry => entry.isDefault);
        if (saved) setAddress(current => ({ ...current, ...saved }));
      })
      .catch(() => {});
  }, [user]);

  const updateAddress = field => event => setAddress(current => ({ ...current, [field]: event.target.value }));

  async function placeOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    clearNotice();
    try {
      const { message, data } = await api('/orders', {
        method: 'POST',
        body: {
          items: items.map(({ productId, qty }) => ({ productId, qty })),
          address,
          slot: { label: form.get('slot') },
          payment: { method: form.get('payment') },
          ...(!user && { guest: { name: address.name, phone: address.phone } })
        }
      });
      clearReceipt();
      showSuccess(message, { keep: true });
      navigate(`/track/${data.orderNo}`);
    } catch (error) {
      if (error.status !== 401) showError(error.message);
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <Placeholder caption="Counter" title="Your receipt is empty." linkTo="/map" linkLabel="Walk the store">
        Add something from the store floor, then come back to the counter.
      </Placeholder>
    );
  }

  return (
    <section className="catalog">
      <div className="panel">
        {items.map(line => (
          <div className="cart-row" key={line.productId}>
            <div className="cart-name">
              <strong>{line.productName}</strong>
              <small>{line.productId} · {formatPrice(line.price)} each</small>
            </div>
            <Stepper name={line.productName} qty={line.qty} max={line.stock} onChange={qty => setQty(line.productId, qty)} />
            <strong className="line-total">{formatPrice(line.price * line.qty)}</strong>
            <button type="button" className="danger" onClick={() => removeItem(line.productId)}>Remove</button>
          </div>
        ))}
        <div className="cart-total"><span>Subtotal <strong>{formatPrice(subtotal)}</strong></span></div>
      </div>

      <form className="panel form-grid" aria-label="Delivery details" onSubmit={placeOrder}>
        <label>Name<input name="name" value={address.name} onChange={updateAddress('name')} autoComplete="name" required /></label>
        <label>Phone<input name="phone" value={address.phone} onChange={updateAddress('phone')} autoComplete="tel" required /></label>
        <label className="full">Address<input name="line1" value={address.line1} onChange={updateAddress('line1')} autoComplete="street-address" required /></label>
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
        <p className="muted full">Payment is simulated. Orders under ₹999 add ₹49 delivery, and the final total is confirmed when you place the order.</p>
      </form>
    </section>
  );
}
