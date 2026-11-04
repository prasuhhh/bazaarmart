import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useReceipt } from '../../context/ReceiptContext.jsx';
import { useAddToReceipt } from '../../hooks/useAddToReceipt.js';
import { useDragToReceipt } from '../../hooks/useDragToReceipt.js';
import { useFetch } from '../../hooks/useFetch.js';
import Thumb from '../ui/Thumb.jsx';
import PriceChip from './PriceChip.jsx';

const CONVEYOR_SIZE = 20;

function ConveyorCard({ product }) {
  const { qtyOf } = useReceipt();
  const addToReceipt = useAddToReceipt();
  const isUnavailable = qtyOf(product.productId) >= product.quantity;
  const { drag, dragProps } = useDragToReceipt(() => { if (!isUnavailable) addToReceipt(product); });
  const image = product.images?.[0];

  return (
    <li className="conveyor-card">
      <Link to={`/p/${product.productId}`} draggable={false} aria-label={product.productName} {...dragProps}>
        <Thumb src={image} />
      </Link>
      <div className="product-foot">
        <PriceChip value={product.productPrice} />
        <button type="button" className="icon-button" aria-label={`Add ${product.productName} to receipt`} disabled={isUnavailable} onClick={() => addToReceipt(product)}>+</button>
      </div>
      {drag && createPortal(
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}><Thumb src={image} /></div>,
        document.body
      )}
    </li>
  );
}

export default function Conveyor() {
  const { data: products, error } = useFetch(`/products?isNew=true&sort=new&limit=${CONVEYOR_SIZE}`);
  return (
    <section className="map-section" aria-label="New drops">
      <p className="caption">Conveyor · new drops · drag onto receipt</p>
      {error && <p className="muted">{error.message}</p>}
      <ul className="conveyor">
        {products?.map(product => <ConveyorCard key={product.productId} product={product} />)}
      </ul>
    </section>
  );
}
