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
const yearOf = order => String(new Date(order.createdAt).getFullYear());

export default function Orders() {
  const { data: orders, loading, error } = useFetch('/orders');
  const [params, setParams] = useSearchParams();
  const active = TABS.find(tab => tab.key === params.get('tab')) ?? TABS[0];
  const year = params.get('year') ?? '';
  const years = [...new Set(orders?.map(yearOf))].sort().reverse();
  const shown = orders?.filter(order => inTab(order, active) && (!year || yearOf(order) === year));

  function chooseParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

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
            onClick={() => chooseParam('tab', tab.key === 'all' ? null : tab.key)}
          >{tabLabel(tab)}</button>
        ))}
        <label className="order-year">Year: 
          <select value={year} aria-label="Filter orders by year" onChange={event => chooseParam('year', event.target.value)}>
            <option value="">all</option>
            {years.map(entry => <option key={entry}>{entry}</option>)}
          </select>
          <span aria-hidden="true"> ▾</span>
        </label>
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
