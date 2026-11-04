import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import Modal from '../ui/Modal.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

// Which zone sells accessories for each kind of gadget.
const ACCESSORY_ZONES = { Phone: 'P', Earbuds: 'A', Watch: 'W', Laptop: 'D', Console: 'G' };

function warrantyText(until) {
  if (!until) return 'No warranty date';
  const date = new Date(until);
  const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return date < new Date() ? `Warranty ended ${label}` : `Warranty until ${label}`;
}

export default function DevicesPanel({ devices, onChanged }) {
  const { busy, run } = useAction();
  const [isAdding, setIsAdding] = useState(false);

  async function add(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const body = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
    if (await run(() => api('/users/me/devices', { method: 'POST', body }))) {
      setIsAdding(false);
      onChanged();
    }
  }

  async function remove(device) {
    if (await run(() => api(`/users/me/devices/${device._id}`, { method: 'DELETE' }), 'Device removed.')) onChanged();
  }

  return (
    <ProfilePanel title="My devices">
      {devices.length === 0 && <PanelRow label="Registered gadgets" detail="None yet" />}
      {devices.map(device => (
        <PanelRow key={device._id} label={device.name} detail={warrantyText(device.warrantyUntil)}>
          {ACCESSORY_ZONES[device.category] && <Link className="link-button" to={`/zone/${ACCESSORY_ZONES[device.category]}`}>Accessories</Link>}
          <button type="button" className="link-button" aria-label={`Remove ${device.name}`} disabled={busy} onClick={() => remove(device)}>Remove</button>
        </PanelRow>
      ))}
      <PanelRow label={<button type="button" className="row-add" onClick={() => setIsAdding(true)}>+ Add</button>} />
      {isAdding && (
        <Modal title="Register a gadget" onClose={() => setIsAdding(false)}>
          <form className="form-grid modal-form" onSubmit={add}>
            <label className="full">Name<input name="name" required /></label>
            <label className="full">Kind
              <select name="category" defaultValue="Phone">
                {Object.keys(ACCESSORY_ZONES).map(category => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>Bought on<input name="purchasedAt" type="date" /></label>
            <label>Warranty until<input name="warrantyUntil" type="date" /></label>
            <div className="form-actions full"><button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
    </ProfilePanel>
  );
}
