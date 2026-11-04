import { Link } from 'react-router-dom';
import { useNotice } from '../../context/NoticeContext.jsx';
import Thumb from '../ui/Thumb.jsx';
import { shortMoment, windowText } from './formatMoment.js';
import Journey from './Journey.jsx';
import ParcelActions from './ParcelActions.jsx';
import RouteMap from './RouteMap.jsx';

function EtaTile({ parcel }) {
  const delivered = parcel.status === 'delivered';
  const isOver = parcel.status === 'cancelled' || parcel.status === 'returned';
  return (
    <section className="eta-tile">
      <p className="caption">{delivered ? 'Delivered' : 'ETA'}</p>
      <strong>{isOver || !parcel.etaAt ? '—' : shortMoment(parcel.etaAt)}</strong>
      {parcel.etaWindow && <small>{windowText(parcel.etaWindow)}</small>}
    </section>
  );
}

export default function ParcelDetails({ parcel, actionPath, onChanged }) {
  const { showInfo } = useNotice();
  return (
    <div className="track">
      <div className="track-main">
        <RouteMap status={parcel.status} />
        <div className="track-tiles">
          <EtaTile parcel={parcel} />
          <section className="dashed-box track-tile">
            <p className="caption">Courier</p>
            <strong>{parcel.courier?.name ?? 'To be assigned'}</strong>
            {parcel.courier?.phone && (
              <p className="courier-links">
                <a href={`tel:${parcel.courier.phone}`}>Call</a> · <button type="button" className="link-button" onClick={() => showInfo('Chat with your courier is simulated in this demo.')}>Chat</button>
              </p>
            )}
          </section>
          <section className="dashed-box track-tile">
            <p className="caption">Delivery OTP</p>
            {parcel.deliveryOtp
              ? <strong className="delivery-otp">{parcel.deliveryOtp}</strong>
              : <small className="muted">Appears here when your parcel is out for delivery.</small>}
          </section>
        </div>
      </div>

      <aside className="journey-card">
        <p className="caption">Journey</p>
        <Journey events={parcel.events} />
        <p className="caption parcel-heading">In this parcel</p>
        <ul className="parcel-items">
          {parcel.items.map(item => (
            <li key={`${item.productId}:${item.colour}`}>
              <Link to={`/p/${item.productId}`} aria-hidden="true" tabIndex={-1}><Thumb src={item.image} /></Link>
              <Link className="product-name" to={`/p/${item.productId}`}>{item.name}{item.qty > 1 && ` × ${item.qty}`}</Link>
            </li>
          ))}
        </ul>
        <ParcelActions parcel={parcel} actionPath={actionPath} onChanged={onChanged} />
      </aside>
    </div>
  );
}
