import { Link } from 'react-router-dom';
import { useBench } from '../../context/BenchContext.jsx';
import Thumb from '../ui/Thumb.jsx';
import PriceChip from './PriceChip.jsx';
import { SaveAndAdd, StockLabel } from './ProductCard.jsx';

export default function ProductRow({ product, onSave }) {
  const { isOnBench, toggleBench } = useBench();
  const onBench = isOnBench(product.productId);
  const specs = Object.entries(product.specs ?? {}).slice(0, 2);

  return (
    <article className="product-row">
      <Link to={`/p/${product.productId}`} tabIndex={-1} aria-hidden="true"><Thumb src={product.images?.[0]} /></Link>
      <div className="product-row-main">
        <Link className="product-name" to={`/p/${product.productId}`}>{product.productName}</Link>
        <small className="muted">{product.productId} · {product.brand}</small>
        <small className="muted">{specs.map(([label, value]) => `${label} ${value}`).join(' · ')}</small>
        <StockLabel quantity={product.quantity} />
      </div>
      <PriceChip value={product.productPrice} />
      <div className="product-row-actions">
        <button type="button" className="link-button" aria-pressed={onBench} onClick={() => toggleBench(product.productId)}>
          {onBench ? 'On bench' : 'Bench'}
        </button>
        <SaveAndAdd product={product} onSave={onSave} />
      </div>
    </article>
  );
}
