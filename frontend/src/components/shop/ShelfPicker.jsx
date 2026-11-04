import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import Modal from '../ui/Modal.jsx';

export default function ShelfPicker({ product, onClose }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const { showSuccess, showError } = useNotice();
  const { data: shelves, loading } = useFetch(user ? '/shelves' : null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveTo(shelfId) {
    const { message } = await api(`/shelves/${shelfId}/items`, { method: 'POST', body: { productId: product.productId } });
    showSuccess(message);
    onClose();
  }

  async function run(task) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      showError(error.message);
      setBusy(false);
    }
  }

  function createAndSave(event) {
    event.preventDefault();
    run(async () => {
      const { data } = await api('/shelves', { method: 'POST', body: { name } });
      await saveTo(data._id);
    });
  }

  if (!user) {
    return (
      <Modal title="Save to a shelf" onClose={onClose}>
        <p className="muted">Sign in to keep shelves and watch for price drops.</p>
        <Link className="primary" to="/signin" state={{ from: pathname + search }}>Sign in</Link>
      </Modal>
    );
  }

  return (
    <Modal title="Save to a shelf" onClose={onClose}>
      <p className="muted">{product.productName}</p>
      {loading && <p className="muted">Loading your shelves…</p>}
      <ul className="shelf-choices">
        {shelves?.map(shelf => (
          <li key={shelf._id}>
            <button type="button" className="outline" disabled={busy} onClick={() => run(() => saveTo(shelf._id))}>
              {shelf.name} <small>· {shelf.items.length}</small>
            </button>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={createAndSave}>
        <input value={name} onChange={event => setName(event.target.value)} placeholder="New shelf name" aria-label="New shelf name" required />
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Create'}</button>
      </form>
    </Modal>
  );
}
