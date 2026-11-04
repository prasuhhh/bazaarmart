import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { formatPrice } from '../../formatPrice.js';
import { useMoveToReceipt } from '../../hooks/useMoveToReceipt.js';
import { STATUS_LABELS } from '../../orderStatus.js';
import { downloadInvoice } from '../../utils/invoice.js';
import Segments from '../ui/Segments.jsx';
import Thumb from '../ui/Thumb.jsx';

const THUMBS_SHOWN = 3;

function statusLine(order) {
  const label = STATUS_LABELS[order.status] ?? order.status;
  if (order.status === 'delivered') {
    const at = order.events?.findLast(event => event.status === 'delivered')?.at;
    return at ? `${label} · ${new Date(at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : label;
  }
  if (order.payment?.status === 'refunded') return `${label} · refund done`;
  return label;
}

export default function OrderCard({ order }) {
  const moveToReceipt = useMoveToReceipt();
  const [busy, setBusy] = useState(false);
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);

  // Stock and prices can change after an order, so each product is loaded fresh.
  async function buyAgain() {
    setBusy(true);
    const sheets = await Promise.allSettled(order.items.map(item => api(`/products/sheet/${encodeURIComponent(item.productId)}`)));
    moveToReceipt(order.items.map((item, index) => ({
      product: sheets[index].status === 'fulfilled' ? sheets[index].value.data.product : null,
      colour: item.colour,
      qty: item.qty
    })));
    setBusy(false);
  }

  return (
    <li className="order-entry">
      <span className="order-node" aria-hidden="true" />
      <article className="order-card">
        <div className="order-summary">
          <h3>#{order.orderNo}</h3>
          <p className="muted">{itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatPrice(order.total)}</p>
        </div>
        <div className="order-thumbs">
          {order.items.slice(0, THUMBS_SHOWN).map(item => (
            <Link key={`${item.productId}:${item.colour}`} to={`/p/${item.productId}`} aria-label={item.name}><Thumb src={item.image} /></Link>
          ))}
        </div>
        <div className="order-progress">
          <Segments status={order.status} />
          <p>{statusLine(order)}</p>
        </div>
        <div className="order-actions">
          <Link className="outline" to={`/track/${order.orderNo}`}>Track</Link>
          <button type="button" className="outline" onClick={() => downloadInvoice(order)}>Invoice</button>
          <button type="button" className="outline" disabled={busy} onClick={buyAgain}>{busy ? 'Please wait…' : 'Buy again'}</button>
        </div>
      </article>
    </li>
  );
}
