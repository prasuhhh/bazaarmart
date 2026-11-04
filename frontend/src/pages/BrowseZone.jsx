import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductCard from '../components/shop/ProductCard.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';

const PAGE_SIZE = 18;
const SEARCH_DELAY_MS = 300;

// A plain listing that keeps shopping working until the bays and dials are built.
export default function BrowseZone() {
  const { zoneCode } = useParams();
  const { addItem, qtyOf } = useReceipt();
  const { showSuccess, showError } = useNotice();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounce(text.trim(), SEARCH_DELAY_MS);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ zone: zoneCode, page, limit: PAGE_SIZE });
    if (search) params.set('q', search);
    if (sort) params.set('sort', sort);

    api(`/products?${params}`)
      .then(result => {
        if (cancelled) return;
        setProducts(result.data);
        setPagination(result.pagination);
      })
      .catch(error => { if (!cancelled && error.status !== 401) showError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [zoneCode, search, sort, page, showError]);

  useEffect(() => {
    setPage(1);
  }, [zoneCode, search, sort]);

  function handleAdd(product) {
    addItem(product);
    showSuccess(`${product.productName} added to receipt.`);
  }

  return (
    <section className="catalog">
      <div className="filters">
        <input type="search" value={text} onChange={event => setText(event.target.value)} placeholder="Search this zone" aria-label="Search this zone" />
        <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort products">
          <option value="">Sort: SKU</option>
          <option value="price_asc">Price: Low to high</option>
          <option value="price_desc">Price: High to low</option>
          <option value="new">Newest first</option>
        </select>
      </div>

      {loading && !products.length ? <p className="empty">Loading the zone…</p>
        : !products.length ? <p className="empty">Nothing on these shelves matches.</p>
          : (
            <div className="product-grid">
              {products.map(product => (
                <ProductCard key={product.productId} product={product} qtyInReceipt={qtyOf(product.productId)} onAdd={handleAdd} />
              ))}
            </div>
          )}

      {pagination.pages > 1 && (
        <div className="pager">
          <button className="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button className="outline" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
