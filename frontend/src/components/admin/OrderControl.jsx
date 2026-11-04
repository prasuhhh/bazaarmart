import { api } from '../../api/client.js';
import { formatPrice } from '../../formatPrice.js';
import { useAction } from '../../hooks/useAction.js';
import { useFetch } from '../../hooks/useFetch.js';
import { STATUS_LABELS } from '../../orderStatus.js';

// Moves demo orders along, one status at a time, so tracking can be shown working.
export default function OrderControl() {
  const { data: orders, error, reload } = useFetch('/admin/orders');
  const { busy, run } = useAction();

  async function setStatus(order, status) {
    const path = `/admin/orders/${encodeURIComponent(order.orderNo)}/status`;
    if (await run(() => api(path, { method: 'PATCH', body: { status } }))) reload();
  }

  if (error && error.status !== 401) return <p className="empty">{error.message}</p>;
  if (!orders) return <p className="empty">Loading orders…</p>;
  if (!orders.length) return <p className="empty">No orders yet.</p>;

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Orders</caption>
        <thead>
          <tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.orderNo}>
              <td>#{order.orderNo}</td>
              <td>{order.customer}{order.isGuest && ' (guest)'}</td>
              <td>{formatPrice(order.total)}</td>
              <td>{STATUS_LABELS[order.status]}</td>
              <td className="row-actions">
                {order.nextStatus && (
                  <button type="button" className="outline" disabled={busy} aria-label={`Mark ${order.orderNo} as ${STATUS_LABELS[order.nextStatus]}`} onClick={() => setStatus(order, order.nextStatus)}>
                    → {STATUS_LABELS[order.nextStatus]}
                  </button>
                )}
                {order.canCancel && (
                  <button type="button" className="danger" disabled={busy} aria-label={`Cancel ${order.orderNo}`} onClick={() => setStatus(order, 'cancelled')}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
