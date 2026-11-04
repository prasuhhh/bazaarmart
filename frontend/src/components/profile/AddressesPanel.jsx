import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import AddressForm from '../counter/AddressForm.jsx';
import Modal from '../ui/Modal.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

export default function AddressesPanel({ addresses, onChanged }) {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(null); // an address, or 'new'

  async function save(values) {
    const done = await run(() => (editing === 'new'
      ? api('/users/me/addresses', { method: 'POST', body: values })
      : api(`/users/me/addresses/${editing._id}`, { method: 'PUT', body: values })));
    if (done) {
      setEditing(null);
      onChanged();
    }
  }

  async function change(task, message) {
    if (await run(task, message)) onChanged();
  }

  return (
    <ProfilePanel title="Addresses">
      {addresses.map(address => (
        <PanelRow key={address._id} label={`${address.label}${address.isDefault ? ' · default' : ''}`} detail={`${address.line1}, ${address.city}`}>
          {!address.isDefault && <button type="button" className="link-button" disabled={busy} onClick={() => change(() => api(`/users/me/addresses/${address._id}`, { method: 'PUT', body: { isDefault: true } }))}>Make default</button>}
          <button type="button" className="link-button" onClick={() => setEditing(address)}>Edit</button>
          <button type="button" className="link-button" aria-label={`Delete ${address.label}`} disabled={busy} onClick={() => change(() => api(`/users/me/addresses/${address._id}`, { method: 'DELETE' }), 'Address removed.')}>Delete</button>
        </PanelRow>
      ))}
      <PanelRow label={<button type="button" className="row-add" onClick={() => setEditing('new')}>+ Add</button>} />
      {editing && (
        <Modal title={editing === 'new' ? 'Add an address' : `Edit ${editing.label}`} onClose={() => setEditing(null)}>
          <AddressForm showLabel initial={editing === 'new' ? undefined : editing} button="Save address" busy={busy} onSubmit={save} />
        </Modal>
      )}
    </ProfilePanel>
  );
}
