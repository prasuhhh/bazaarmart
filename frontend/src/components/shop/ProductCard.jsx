import { Link } from 'react-router-dom';
import { formatPrice } from '../../formatPrice.js';
import Thumb from '../ui/Thumb.jsx';

const LOW_STOCK_THRESHOLD = 5;

function StockLabel({ quantity }) {
  if (quantity === 0) return <span className="stock out">Out of stock</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) return <span className="stock low">Only {quantity} left</span>;
  return null;
}

export default function ProductCard({ product, qtyInReceipt, onAdd }) {
  const unavailable = product.quantity === 0 || qtyInReceipt >= product.quantity;
  return (
    <article className="product-card">
      <Link to={`/p/${product.productId}`}>
        <Thumb src={product.images?.[0]} alt={product.productName} />
      </Link>
      <Link className="product-name" to={`/p/${product.productId}`}>{product.productName}</Link>
      <StockLabel quantity={product.quantity} />
      <div className="product-foot">
        <span className="price-chip">{formatPrice(product.productPrice)}</span>
        <button
          type="button"
          className="add-button"
          aria-label={`Add ${product.productName} to receipt`}
          disabled={unavailable}
          onClick={() => onAdd(product)}
        >+</button>
      </div>
    </article>
  );
}
