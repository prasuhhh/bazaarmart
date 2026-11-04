import { Link, useSearchParams } from 'react-router-dom';
import OrderCard from '../components/orders/OrderCard.jsx';
import { useFetch } from '../hooks/useFetch.js';

const TABS = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'live', label: 'Live', statuses: ['placed', 'packed', 'shipped', 'out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { key: 'returns', label: 'Returns', statuses: ['returned'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] }
];

const inTab = (order, tab) => !tab.statuses || tab.statuses.includes(order.status);

export default function Orders() {
  const { data: orders, loading, error } = useFetch('/orders');
  const [params, setParams] = useSearchParams();
  const active = TABS.find(tab => tab.key === params.get('tab')) ?? TABS[0];
  const shown = orders?.filter(order => inTab(order, active));

  function tabLabel(tab) {
    if (tab.key !== 'live' || !orders) return tab.label;
    return `${tab.label} (${orders.filter(order => inTab(order, tab)).length})`;
  }

  return (
    <section className="orders">
      <div className="tabs order-tabs" role="group" aria-label="Filter orders">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.key}
            className={`order-tab${tab === active ? ' on' : ''}`}
            aria-pressed={tab === active}
            onClick={() => setParams(tab.key === 'all' ? {} : { tab: tab.key }, { replace: true })}
          >{tabLabel(tab)}</button>
        ))}
      </div>

      {error && error.status !== 401 && <p className="empty">{error.message}</p>}
      {loading && !orders && <p className="empty">Pulling your receipts…</p>}
      {shown?.length === 0 && (
        orders.length ? <p className="empty">Nothing under {active.label}.</p> : (
          <div className="empty">
            <p>You haven't placed any orders yet.</p>
            <Link className="primary" to="/map">Walk the store</Link>
          </div>
        )
      )}
      {shown?.length > 0 && (
        <ol className="order-timeline">
          {shown.map(order => <OrderCard key={order._id} order={order} />)}
        </ol>
      )}
    </section>
  );
}
