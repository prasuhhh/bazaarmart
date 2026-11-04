import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useNotice } from '../context/NoticeContext.jsx';
import { formatPrice } from '../formatPrice.js';

export default function Orders() {
  const { showError } = useNotice();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/orders')
      .then(({ data }) => setOrders(data))
      .catch(error => { if (error.status !== 401) showError(error.message); })
      .finally(() => setLoading(false));
  }, [showError]);

  return (
    <section className="catalog">
      <div className="section-heading"><div><span className="eyebrow">ORDERS</span><h3>Order history</h3></div></div>
      {loading ? <p className="empty">Loading orders…</p>
        : !orders.length ? (
          <>
            <p className="empty">You haven't placed any orders yet.</p>
            <Link className="primary" to="/products">Browse products</Link>
          </>
        ) : orders.map(order => (
          <article className="panel order" key={order._id}>
            <div className="order-head">
              <span>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="category">{order.status}</span>
            </div>
            {order.items.map(item => (
              <div className="order-line" key={item.productId}>
                <span>{item.productName} × {item.qty}</span>
                <span>{formatPrice(item.price * item.qty)}</span>
              </div>
            ))}
            <div className="order-line order-total"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          </article>
        ))}
    </section>
  );
}
