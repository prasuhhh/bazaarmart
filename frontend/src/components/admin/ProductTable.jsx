import { useMemo, useState } from 'react';
import PriceChip from '../shop/PriceChip.jsx';
import ProductGrid from '../shop/ProductGrid.jsx';
import Thumb from '../ui/Thumb.jsx';

export default function ProductTable({ products, busy, onEdit, onDelete }) {
  const [text, setText] = useState('');
  const shown = useMemo(() => {
    const search = text.trim().toLowerCase();
    if (!search) return products;
    return products.filter(product => `${product.productId} ${product.productName} ${product.category}`.toLowerCase().includes(search));
  }, [products, text]);

  return (
    <>
      <input className="admin-search" type="search" value={text} onChange={event => setText(event.target.value)} placeholder="Filter by SKU, name or category" aria-label="Filter products" />
      <ProductGrid>
        {shown.map(product => (
          <article className="product-card" key={product.productId}>
            <Thumb src={product.images?.[0]} />
            <span className="product-name">{product.productName}</span>
            <small className="muted">{product.productId} · {product.category}</small>
            <div className="product-foot">
              <PriceChip value={product.productPrice} />
              <span className="stock">Stock {product.quantity}</span>
            </div>
            <div className="row-actions">
              <button type="button" className="outline" aria-label={`Edit ${product.productName}`} onClick={() => onEdit(product)}>Edit</button>
              <button type="button" className="danger" aria-label={`Delete ${product.productName}`} disabled={busy} onClick={() => onDelete(product)}>Delete</button>
            </div>
          </article>
        ))}
      </ProductGrid>
      {!shown.length && <p className="empty">No products match.</p>}
    </>
  );
}
