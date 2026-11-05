import { Link } from 'react-router-dom';
import { formatPrice } from '../../formatPrice.js';
import Thumb from '../ui/Thumb.jsx';

function PriceWatch({ change }) {
  if (change < 0) return <span className="price-drop">↓ {-change}% since saved</span>;
  if (change > 0) return <span className="price-rise">↑ {change}% since saved</span>;
  return null;
}

export default function ShelfItem({ item, onRemove }) {
  return (
    <li className="product-card shelf-item">
      <Thumb src={item.image} />
      <div className="shelf-item-main">
        {item.available ? <Link className="product-name" to={`/p/${item.productId}`} title={item.productName}>{item.productName}</Link>
          : <span className="product-name muted">{item.productId} is no longer stocked</span>}
        {item.available && (
          <p className="shelf-item-price">
            <span>{formatPrice(item.currentPrice)}</span> <PriceWatch change={item.percentChange} />
          </p>
        )}
        {item.available && item.stock === 0 && <span className="stock out">Out of stock</span>}
      </div>
      {onRemove && (
        <button type="button" className="icon-button" aria-label={`Remove ${item.productName ?? item.productId}`} onClick={() => onRemove(item)}>×</button>
      )}
    </li>
  );
}

export const toReceiptEntry = item => ({
  product: item.available ? {
    productId: item.productId,
    productName: item.productName,
    productPrice: item.currentPrice,
    quantity: item.stock,
    images: [item.image],
    colours: item.colours
  } : null
});
