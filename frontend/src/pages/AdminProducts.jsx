import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client.js';
import OrderControl from '../components/admin/OrderControl.jsx';
import ProductForm from '../components/admin/ProductForm.jsx';
import ProductTable from '../components/admin/ProductTable.jsx';
import { useAction } from '../hooks/useAction.js';
import { useFetch } from '../hooks/useFetch.js';

const productPath = product => `/products?productId=${encodeURIComponent(product.productId)}`;

export default function AdminProducts() {
  const { zones } = useOutletContext();
  const { data: products, error, reload } = useFetch('/products');
  const { busy, run } = useAction();
  const [editing, setEditing] = useState(null);

  async function saveProduct(body, form) {
    const saved = await run(() => (editing
      ? api(productPath(editing), { method: 'PUT', body })
      : api('/products', { method: 'POST', body })));
    if (!saved) return;
    setEditing(null);
    form.reset();
    reload();
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.productName}? This cannot be undone.`)) return;
    const deleted = await run(() => api(productPath(product), { method: 'DELETE' }), `${product.productName} deleted.`);
    if (!deleted) return;
    if (editing?.productId === product.productId) setEditing(null);
    reload();
  }

  return (
    <div className="admin">
      <section className="admin-card">
        <p className="caption">Order status · advance for demos</p>
        <OrderControl />
      </section>
      <section className="admin-card">
        <p className="caption">{editing ? `Edit ${editing.productId}` : 'Add a product'}</p>
        <ProductForm product={editing} zones={zones} busy={busy} onSubmit={saveProduct} onCancel={() => setEditing(null)} />
      </section>
      <section className="admin-card">
        <p className="caption">Products{products && ` · ${products.length}`}</p>
        {error && error.status !== 401 && <p className="empty">{error.message}</p>}
        {!products && !error && <p className="empty">Loading products…</p>}
        {products && <ProductTable products={products} busy={busy} onEdit={setEditing} onDelete={deleteProduct} />}
      </section>
    </div>
  );
}
