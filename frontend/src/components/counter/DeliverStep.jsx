import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';
import AddressForm from './AddressForm.jsx';

export const addressSummary = address => `${address.label ?? address.name} · ${address.line1}`;

export default function DeliverStep({ saved, chosen, onChoose, onAdded }) {
  const { user } = useAuth();
  const { showError } = useNotice();
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveAddress(address) {
    setBusy(true);
    try {
      const { data } = await api('/users/me/addresses', { method: 'POST', body: address });
      onAdded();
      setIsAdding(false);
      onChoose(data);
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <AddressForm initial={chosen} button="Deliver here" onSubmit={onChoose} />;

  if (!saved?.length || isAdding) {
    return (
      <>
        <AddressForm showLabel button="Save and deliver here" busy={busy} onSubmit={saveAddress} />
        {saved?.length > 0 && <button type="button" className="link-button step-link" onClick={() => setIsAdding(false)}>Back to saved addresses</button>}
      </>
    );
  }

  return (
    <div className="choice-list">
      {saved.map(address => (
        <button
          type="button"
          key={address._id}
          className={`pill${address._id === chosen?._id ? ' on' : ''}`}
          aria-pressed={address._id === chosen?._id}
          onClick={() => onChoose(address)}
        >
          <strong>{address.label ?? address.name}</strong> {address.line1}, {address.city} {address.pincode}
        </button>
      ))}
      <button type="button" className="link-button" onClick={() => setIsAdding(true)}>+ Add an address</button>
    </div>
  );
}
