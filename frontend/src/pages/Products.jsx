import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ProductCard from '../components/ProductCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

const PAGE_SIZE = 9;
const SEARCH_DELAY_MS = 300;

function buildPath({ category, search, sort, page }) {
  const params = new URLSearchParams({ page, limit: PAGE_SIZE });
  if (search.trim()) params.set('q', search.trim());
  if (sort) params.set('sort', sort);
  const base = category ? `/products/${encodeURIComponent(category)}` : '/products';
  return `${base}?${params}`;
}

export default function Products() {
  const { user } = useAuth();
  const { addItem, qtyInCart } = useCart();
  const { showSuccess, showError } = useNotice();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api('/products')
      .then(({ data }) => setCategories([...new Set(data.map(product => product.category))].sort()))
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api(buildPath({ category, search, sort, page }));
        if (cancelled) return;
        setProducts(result.data);
        setPagination(result.pagination);
      } catch (error) {
        if (cancelled) return;
        setProducts([]);
        setPagination({ page: 1, pages: 1, total: 0 });
        // The category route answers 404 when nothing matches, which is just an empty result here.
        if (error.status !== 404 && error.status !== 401) showError(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, search, sort, page, refreshKey, showError]);

  function changeFilter(setter) {
    return event => {
      setter(event.target.value);
      setPage(1);
    };
  }

  function handleAdd(product) {
    addItem(product);
    showSuccess(`${product.productName} added to cart.`);
  }

  return (
    <section className="catalog">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CATALOGUE</span>
          <h3>Welcome, {user.username}</h3>
        </div>
        <button className="outline" onClick={() => setRefreshKey(key => key + 1)}>Refresh</button>
      </div>

      <div className="filters">
        <input
          type="search"
          value={search}
          onChange={changeFilter(setSearch)}
          placeholder="Search products by name"
          aria-label="Search products by name"
        />
        <select value={category} onChange={changeFilter(setCategory)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={sort} onChange={changeFilter(setSort)} aria-label="Sort products">
          <option value="">Sort: Default</option>
          <option value="price_asc">Price: Low to high</option>
          <option value="price_desc">Price: High to low</option>
          <option value="name">Name: A to Z</option>
          <option value="new">Newest first</option>
        </select>
      </div>

      {loading && products.length === 0 ? <p className="empty">Loading products…</p>
        : products.length === 0 ? <p className="empty">No products match your search.</p>
          : (
            <div className="product-grid">
              {products.map(product => (
                <ProductCard
                  key={product.productId}
                  product={product}
                  qtyInCart={qtyInCart(product.productId)}
                  onAdd={handleAdd}
                />
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
