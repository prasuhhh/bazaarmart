import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import Modal from '../ui/Modal.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

const ROWS = [['sizes', 'Sizes'], ['colours', 'Fits & colours'], ['brands', 'Brands I like']];
const toList = text => text.split(',').map(entry => entry.trim()).filter(Boolean);

export default function StylePanel({ prefs, onChanged }) {
  const { busy, run } = useAction();
  const [isEditing, setIsEditing] = useState(false);

  async function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const stylePrefs = Object.fromEntries(Object.entries(values).map(([key, text]) => [key, toList(text)]));
    if (await run(() => api('/users/me/prefs', { method: 'PATCH', body: { stylePrefs } }))) {
      setIsEditing(false);
      onChanged();
    }
  }

  return (
    <ProfilePanel title="Style profile">
      {ROWS.map(([key, label]) => <PanelRow key={key} label={label} detail={prefs?.[key]?.join(', ') || 'Not set'} />)}
      <PanelRow label={<button type="button" className="row-add" onClick={() => setIsEditing(true)}>Edit</button>} />
      {isEditing && (
        <Modal title="Style profile" onClose={() => setIsEditing(false)}>
          <form className="form-grid modal-form" onSubmit={save}>
            {ROWS.map(([key, label]) => (
              <label className="full" key={key}>{label}<input name={key} defaultValue={prefs?.[key]?.join(', ')} placeholder="Separate with commas" /></label>
            ))}
            <div className="form-actions full"><button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
    </ProfilePanel>
  );
}
