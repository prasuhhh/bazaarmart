import { useMemo, useState } from 'react';
import { formatPrice } from '../../formatPrice.js';

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
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Products</caption>
          <thead>
            <tr><th scope="col">SKU</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {shown.map(product => (
              <tr key={product.productId}>
                <td>{product.productId}</td>
                <td>{product.productName}</td>
                <td>{product.category}</td>
                <td>{formatPrice(product.productPrice)}</td>
                <td>{product.quantity}</td>
                <td className="row-actions">
                  <button type="button" className="outline" aria-label={`Edit ${product.productName}`} onClick={() => onEdit(product)}>Edit</button>
                  <button type="button" className="danger" aria-label={`Delete ${product.productName}`} disabled={busy} onClick={() => onDelete(product)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="empty">No products match.</p>}
    </>
  );
}
