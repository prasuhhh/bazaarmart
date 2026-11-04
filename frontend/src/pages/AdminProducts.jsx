import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useNotice } from '../context/NoticeContext.jsx';
import { formatPrice } from '../formatPrice.js';

export default function AdminProducts() {
  const { showSuccess, showError, clearNotice } = useNotice();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    try {
      const { data } = await api('/products');
      setProducts(data);
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // Load once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    body.productPrice = Number(body.productPrice);
    body.quantity = Number(body.quantity);
    setBusy(true);
    clearNotice();
    try {
      const { message } = editing
        ? await api(`/products?productId=${encodeURIComponent(editing.productId)}`, { method: 'PUT', body })
        : await api('/products', { method: 'POST', body });
      setEditing(null);
      form.reset();
      showSuccess(message);
      await loadProducts();
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete ${product.productName}? This cannot be undone.`)) return;
    setBusy(true);
    clearNotice();
    try {
      await api(`/products?productId=${encodeURIComponent(product.productId)}`, { method: 'DELETE' });
      if (editing?.productId === product.productId) setEditing(null);
      showSuccess(`${product.productName} deleted.`);
      await loadProducts();
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="catalog">
      <div className="section-heading"><div><span className="eyebrow">ADMIN</span><h3>Manage products</h3></div></div>

      <div className="panel">
        <h4 className="panel-title">{editing ? `Edit ${editing.productId}` : 'Add a product'}</h4>
        {/* The key refills the form whenever a different product is chosen. */}
        <form key={editing?.productId || 'new'} className="form-grid" onSubmit={handleSubmit}>
          {!editing && <label>Product ID<input name="productId" placeholder="P006" required /></label>}
          <label>Name<input name="productName" defaultValue={editing?.productName} required /></label>
          <label>Price (₹)<input name="productPrice" type="number" min="0" step="any" defaultValue={editing?.productPrice} required /></label>
          <label>Category<input name="category" defaultValue={editing?.category} required /></label>
          <label>Quantity<input name="quantity" type="number" min="0" step="1" defaultValue={editing?.quantity} required /></label>
          <label className="full">Description<textarea name="description" rows="3" defaultValue={editing?.description} required /></label>
          <div className="form-actions full">
            <button className="primary" disabled={busy}>{busy ? 'Please wait…' : editing ? 'Save changes' : 'Add product'}</button>
            {editing && <button type="button" className="outline" onClick={() => setEditing(null)}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="panel table-wrap">
        {loading ? <p className="empty">Loading products…</p> : !products.length ? <p className="empty">No products yet.</p> : (
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.productId}>
                  <td>{product.productId}</td>
                  <td>{product.productName}</td>
                  <td>{product.category}</td>
                  <td>{formatPrice(product.productPrice)}</td>
                  <td>{product.quantity}</td>
                  <td className="row-actions">
                    <button className="outline" onClick={() => setEditing(product)}>Edit</button>
                    <button className="danger" disabled={busy} onClick={() => handleDelete(product)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
