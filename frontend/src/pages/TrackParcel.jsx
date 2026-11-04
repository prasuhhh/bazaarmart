import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ParcelDetails from '../components/track/ParcelDetails.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import Placeholder from './Placeholder.jsx';

const REFRESH_MS = 30000;
const FINISHED = ['delivered', 'returned', 'cancelled'];

function GuestForm({ title, message, askOrderNo, onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }
  return (
    <section className="dashed-box track-form">
      <p className="caption">Track parcel</p>
      <h2>{title}</h2>
      {message && <p className="muted">{message}</p>}
      <form className="form-grid" onSubmit={handleSubmit}>
        {askOrderNo && <label>Order number<input name="orderNo" placeholder="BM-2041" required /></label>}
        <label>Phone used at checkout<input name="phone" type="tel" autoComplete="tel" required /></label>
        <div className="form-actions full"><button className="primary">Find my parcel</button></div>
      </form>
    </section>
  );
}

function Parcel({ orderNo, startingPhone }) {
  const { pathname } = useLocation();
  const [phone, setPhone] = useState(startingPhone ?? '');
  const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
  const { data: parcel, error, reload } = useFetch(`/orders/${encodeURIComponent(orderNo)}/track${query}`);

  // The Track page is the one people leave open, so it refreshes itself.
  const isFinished = FINISHED.includes(parcel?.status);
  useEffect(() => {
    if (!parcel || isFinished) return undefined;
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [Boolean(parcel), isFinished, reload]);

  if (error?.status === 404) {
    return <Placeholder caption="Track parcel" title={`No order #${orderNo}.`} linkTo="/orders" linkLabel="See your orders">Check the number on your receipt.</Placeholder>;
  }
  if (error?.status === 401) {
    return (
      <div className="dashed-box track-form">
        <p className="caption">Track parcel</p>
        <h2>Sign in to track this parcel.</h2>
        <Link className="primary" to="/signin" state={{ from: pathname }}>Sign in</Link>
      </div>
    );
  }
  if (error?.status === 400 || error?.status === 403) {
    return (
      <GuestForm
        title={`Find #${orderNo}`}
        message={error.status === 403 ? error.message : 'Enter the phone number used at checkout.'}
        onSubmit={values => setPhone(values.phone)}
      />
    );
  }
  if (error) return <p className="empty">{error.message}</p>;
  if (parcel?.orderNo !== orderNo) return <p className="empty">Finding your parcel…</p>;
  return <ParcelDetails parcel={parcel} actionPath={`/orders/${encodeURIComponent(orderNo)}${query}`} onChanged={reload} />;
}

export default function TrackParcel() {
  const { orderNo } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (orderNo) return <Parcel key={orderNo} orderNo={orderNo} startingPhone={state?.phone} />;
  return (
    <GuestForm
      askOrderNo
      title={user ? 'No live parcel right now.' : 'Checked out as a guest?'}
      message={user ? 'Looking for a guest order? Enter its number and phone.' : 'Enter your order number and phone to follow it.'}
      onSubmit={values => navigate(`/track/${values.orderNo.trim().replace(/^#/, '').toUpperCase()}`, { state: { phone: values.phone } })}
    />
  );
}
