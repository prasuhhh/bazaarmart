import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useBench } from '../../context/BenchContext.jsx';
import { useReceipt } from '../../context/ReceiptContext.jsx';
import { useAddToReceipt } from '../../hooks/useAddToReceipt.js';
import Thumb from '../ui/Thumb.jsx';
import { specRows } from './SpecTable.jsx';

// Prices and stock are fetched fresh, so the comparison is never out of date.
export default function BenchTable() {
  const { skus, toggleBench } = useBench();
  const { qtyOf } = useReceipt();
  const addToReceipt = useAddToReceipt();
  const [products, setProducts] = useState(null);
  const skuKey = skus.join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(skuKey.split(',').filter(Boolean).map(sku => api(`/products/sheet/${encodeURIComponent(sku)}`))).then(results => {
      if (!cancelled) setProducts(results.filter(result => result.status === 'fulfilled').map(result => result.value.data.product));
    });
    return () => { cancelled = true; };
  }, [skuKey]);

  if (!skus.length) return <p className="empty">The bench is empty. Open a product and choose Put on bench, or use Bench in list view.</p>;
  if (!products) return <p className="empty">Clearing the bench…</p>;

  const rowOf = product => Object.fromEntries(specRows(product));
  const labels = [...new Set(products.flatMap(product => Object.keys(rowOf(product))))];

  return (
    <div className="table-wrap bench-table">
      <table>
        <caption className="sr-only">Products side by side</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Detail</span></th>
            {products.map(product => (
              <th scope="col" key={product.productId}>
                <Link to={`/p/${product.productId}`}>
                  <Thumb src={product.images?.[0]} />
                  <span>{product.productName}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map(label => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {products.map(product => <td key={product.productId}>{rowOf(product)[label] ?? '—'}</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row"><span className="sr-only">Actions</span></th>
            {products.map(product => (
              <td key={product.productId} className="bench-actions">
                <button type="button" className="primary" disabled={qtyOf(product.productId) >= product.quantity} onClick={() => addToReceipt(product)}>Add</button>
                <button type="button" className="link-button" aria-label={`Take ${product.productName} off the bench`} onClick={() => toggleBench(product.productId)}>Take off</button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
