import { formatPrice } from '../../formatPrice.js';
import Modal from '../ui/Modal.jsx';

export default function MockPayment({ methodLabel, total, isPaid, busy, onConfirm, onCancel }) {
  if (isPaid) {
    return (
      <Modal title="Payment successful" onClose={() => {}}>
        <p className="muted">Taking you to your parcel…</p>
      </Modal>
    );
  }
  return (
    <Modal title="Simulated payment" onClose={onCancel}>
      <p className="mock-amount">{formatPrice(total)} · {methodLabel}</p>
      <p className="muted">This is a demo. No real money moves, and no details are collected.</p>
      <button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy ? 'Please wait…' : 'Confirm payment'}</button>
    </Modal>
  );
}
