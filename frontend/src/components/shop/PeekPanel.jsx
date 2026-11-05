import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import Thumb from '../ui/Thumb.jsx';
import { thumbOf } from '../../utils/productImage.js';

const PEEK_SIZE = 9;
const PEEK_COLUMNS = 3;

function rowsOf(products) {
  const rows = [];
  for (let start = 0; start < products.length; start += PEEK_COLUMNS) rows.push(products.slice(start, start + PEEK_COLUMNS));
  return rows;
}

export default function PeekPanel({ zone }) {
  const { data: products, error } = useFetch(zone ? `/products?zone=${zone.code}&limit=${PEEK_SIZE}` : null);

  return (
    <aside className="peek-panel" aria-label="Peek at this zone">
      <div className="peek-head">
        <h3>{zone?.name ?? 'Peek'}</h3>
        <span className="muted">peek</span>
      </div>
      {error && <p className="muted">{error.message}</p>}
      {rowsOf(products ?? []).map(row => (
        <div className="peek-row" key={row[0].productId}>
          {row.map(product => (
            <Link key={product.productId} className="peek-item" to={`/p/${product.productId}`} aria-label={product.productName}>
              <Thumb src={thumbOf(product.images?.[0])} />
              <small>{product.productId}</small>
            </Link>
          ))}
          {Array.from({ length: PEEK_COLUMNS - row.length }, (_, index) => <span key={index} className="peek-item" aria-hidden="true" />)}
        </div>
      ))}
    </aside>
  );
}
