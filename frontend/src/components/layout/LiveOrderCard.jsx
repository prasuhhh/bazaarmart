import { Link } from 'react-router-dom';
import Segments from '../ui/Segments.jsx';

const etaLabel = etaAt => (etaAt
  ? new Date(etaAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  : 'to be confirmed');

export default function LiveOrderCard({ order }) {
  return (
    <Link className="live-card" to={`/track/${order.orderNo}`}>
      <strong>LIVE ORDER #{order.orderNo}</strong>
      <Segments status={order.status} />
      <span>Delivery · {etaLabel(order.etaAt)}</span>
    </Link>
  );
}
