import { Link } from 'react-router-dom';
import { useReceipt } from '../../context/ReceiptContext.jsx';
import { useAddToReceipt } from '../../hooks/useAddToReceipt.js';
import Thumb from '../ui/Thumb.jsx';
import PriceChip from './PriceChip.jsx';

const LOW_STOCK_THRESHOLD = 5;

export function StockLabel({ quantity }) {
  if (quantity === 0) return <span className="stock out">Out of stock</span>;
  if (quantity <= LOW_STOCK_THRESHOLD) return <span className="stock low">Only {quantity} left</span>;
  return null;
}

export function SaveAndAdd({ product, onSave }) {
  const { qtyOf } = useReceipt();
  const addToReceipt = useAddToReceipt();
  const isUnavailable = qtyOf(product.productId) >= product.quantity;
  return (
    <span className="card-actions">
      <button type="button" className="icon-button" aria-label={`Save ${product.productName} to a shelf`} onClick={() => onSave(product)}>☆</button>
      <button type="button" className="icon-button" aria-label={`Add ${product.productName} to receipt`} disabled={isUnavailable} onClick={() => addToReceipt(product)}>+</button>
    </span>
  );
}

export default function ProductCard({ product, onSave }) {
  const href = `/p/${product.productId}`;
  return (
    <article className="product-card">
      <Link to={href} tabIndex={-1} aria-hidden="true"><Thumb src={product.images?.[0]} /></Link>
      <Link className="product-name" to={href} title={product.productName}>{product.productName}</Link>
      <div className="product-foot">
        <PriceChip value={product.productPrice} />
        <StockLabel quantity={product.quantity} />
        <SaveAndAdd product={product} onSave={onSave} />
      </div>
    </article>
  );
}
