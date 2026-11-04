import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import Modal from '../ui/Modal.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

const describe = method => (method.type === 'upi' ? `UPI · ${method.label}` : `${method.label} ···· ${method.last4}`);

export default function PaymentsPanel({ methods, onChanged }) {
  const { busy, run } = useAction();
  const [isAdding, setIsAdding] = useState(false);
  const [type, setType] = useState('upi');

  async function add(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await run(() => api('/users/me/payment-methods', { method: 'POST', body: { type, ...values } }))) {
      setIsAdding(false);
      onChanged();
    }
  }

  async function remove(method) {
    if (await run(() => api(`/users/me/payment-methods/${method._id}`, { method: 'DELETE' }), 'Payment method removed.')) onChanged();
  }

  return (
    <ProfilePanel title="Payments">
      {methods.map(method => (
        <PanelRow key={method._id} label={describe(method)}>
          <button type="button" className="link-button" aria-label={`Remove ${describe(method)}`} disabled={busy} onClick={() => remove(method)}>Remove</button>
        </PanelRow>
      ))}
      <PanelRow label={<button type="button" className="row-add" onClick={() => setIsAdding(true)}>+ Add</button>} />
      {isAdding && (
        <Modal title="Add a payment label" onClose={() => setIsAdding(false)}>
          <p className="muted">Display only. Payments here are simulated, so we never ask for a full card number, CVV or PIN.</p>
          <div className="tabs" role="group" aria-label="Payment type">
            <button type="button" className={`pill${type === 'upi' ? ' on' : ''}`} aria-pressed={type === 'upi'} onClick={() => setType('upi')}>UPI</button>
            <button type="button" className={`pill${type === 'card' ? ' on' : ''}`} aria-pressed={type === 'card'} onClick={() => setType('card')}>Card</button>
          </div>
          <form key={type} className="form-grid modal-form" onSubmit={add}>
            {type === 'upi' ? (
              <label className="full">UPI handle<input name="label" placeholder="name@bank" required /></label>
            ) : (
              <>
                <label>Card name<input name="label" placeholder="Visa" required /></label>
                <label>Last 4 digits<input name="last4" inputMode="numeric" maxLength="4" pattern="[0-9]{4}" required /></label>
              </>
            )}
            <div className="form-actions full"><button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
    </ProfilePanel>
  );
}
