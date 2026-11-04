import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch.js';
import Thumb from '../ui/Thumb.jsx';

const PEEK_SIZE = 9;
const PEEK_COLUMNS = 3;

export default function PeekPanel({ zone }) {
  const { data: products, error } = useFetch(zone ? `/products?zone=${zone.code}&limit=${PEEK_SIZE}` : null);

  // Empty cells carry each shelf line across the full width of a part-filled row.
  const spareCells = products ? (PEEK_COLUMNS - (products.length % PEEK_COLUMNS)) % PEEK_COLUMNS : 0;

  return (
    <aside className="peek-panel" aria-label="Peek at this zone">
      <div className="peek-head">
        <h3>{zone?.name ?? 'Peek'}</h3>
        <span className="muted">peek</span>
      </div>
      {error && <p className="muted">{error.message}</p>}
      <div className="peek-grid">
        {products?.map(product => (
          <Link key={product.productId} className="peek-item" to={`/p/${product.productId}`} aria-label={product.productName}>
            <Thumb src={product.images?.[0]} />
            <small>{product.productId}</small>
          </Link>
        ))}
        {Array.from({ length: spareCells }, (_, index) => <span key={index} className="peek-item" aria-hidden="true" />)}
      </div>
    </aside>
  );
}
