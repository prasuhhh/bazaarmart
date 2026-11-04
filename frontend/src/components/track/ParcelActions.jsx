import { useState } from 'react';
import { api } from '../../api/client.js';
import { useNotice } from '../../context/NoticeContext.jsx';
import WhenStep from '../counter/WhenStep.jsx';
import Modal from '../ui/Modal.jsx';

const SLOT_CHANGEABLE = ['placed', 'packed', 'shipped'];
const DOOR_CHANGEABLE = [...SLOT_CHANGEABLE, 'out_for_delivery'];
const CANCELLABLE = ['placed', 'packed'];

export default function ParcelActions({ parcel, actionPath, onChanged }) {
  const { showSuccess, showError } = useNotice();
  const [dialog, setDialog] = useState(null);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(body) {
    setBusy(true);
    try {
      const { message } = await api(actionPath, { method: 'PATCH', body });
      showSuccess(message);
      setDialog(null);
      onChanged();
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  const closeDialog = () => {
    setDialog(null);
    setIsConfirmingCancel(false);
  };

  return (
    <div className="parcel-actions">
      <button type="button" className="outline" disabled={!SLOT_CHANGEABLE.includes(parcel.status)} onClick={() => setDialog('slot')}>Change slot</button>
      <button
        type="button"
        className={`outline${parcel.leaveAtDoor ? ' chosen' : ''}`}
        aria-pressed={parcel.leaveAtDoor}
        disabled={busy || !DOOR_CHANGEABLE.includes(parcel.status)}
        onClick={() => update({ leaveAtDoor: !parcel.leaveAtDoor })}
      >Leave at door</button>
      <button type="button" className="outline" onClick={() => setDialog('help')}>Help</button>

      {dialog === 'slot' && (
        <Modal title="Change slot" onClose={closeDialog}>
          <p className="muted">Booked for {parcel.slot?.label ?? 'no slot yet'}.</p>
          <WhenStep chosen={parcel.slot} onChoose={slot => update({ slot })} />
        </Modal>
      )}

      {dialog === 'help' && (
        <Modal title="Help" onClose={closeDialog}>
          <p className="muted">Your courier is the quickest way to reach this parcel. This is a demo store, so there's no support desk behind this page.</p>
          {CANCELLABLE.includes(parcel.status) && (isConfirmingCancel ? (
            <div className="form-actions" role="group" aria-label="Cancel this order?">
              <button type="button" className="outline" onClick={() => setIsConfirmingCancel(false)}>Keep my order</button>
              <button type="button" className="danger solid" disabled={busy} onClick={() => update({ cancel: true })}>{busy ? 'Please wait…' : 'Yes, cancel it'}</button>
            </div>
          ) : (
            <button type="button" className="danger" onClick={() => setIsConfirmingCancel(true)}>Cancel this order</button>
          ))}
        </Modal>
      )}
    </div>
  );
}
