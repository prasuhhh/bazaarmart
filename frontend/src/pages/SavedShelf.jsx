import { useState } from 'react';
import { api } from '../api/client.js';
import ShelfCard from '../components/shop/ShelfCard.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { useFetch } from '../hooks/useFetch.js';

export default function SavedShelf() {
  const { data: shelves, loading, error, reload } = useFetch('/shelves');
  const { showSuccess, showError, clearNotice } = useNotice();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Returns whether the change went through, so a form can stay open if it didn't.
  async function run(task, successMessage) {
    setBusy(true);
    clearNotice();
    try {
      const result = await task();
      showSuccess(successMessage ?? result.message);
      reload();
      return true;
    } catch (error) {
      if (error.status !== 401) showError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createShelf(event) {
    event.preventDefault();
    if (await run(() => api('/shelves', { method: 'POST', body: { name } }))) setName('');
  }

  const renameShelf = (shelf, nextName) => run(() => api(`/shelves/${shelf._id}`, { method: 'PATCH', body: { name: nextName } }));
  const deleteShelf = shelf => run(() => api(`/shelves/${shelf._id}`, { method: 'DELETE' }), `${shelf.name} deleted.`);
  const removeItem = (shelf, item) => run(
    () => api(`/shelves/${shelf._id}/items/${encodeURIComponent(item.productId)}`, { method: 'DELETE' }),
    'Removed from the shelf.'
  );

  return (
    <section className="saved">
      <form className="inline-form new-shelf" onSubmit={createShelf}>
        <input value={name} maxLength="60" onChange={event => setName(event.target.value)} placeholder="Name a new shelf" aria-label="New shelf name" required />
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Create shelf'}</button>
      </form>

      {error && error.status !== 401 && <p className="empty">{error.message}</p>}
      {loading && !shelves && <p className="empty">Dusting the shelves…</p>}
      {shelves?.length === 0 && <p className="empty">No shelves yet. Name one above, or tap ☆ on any product.</p>}
      <div className="shelf-grid">
        {shelves?.map(shelf => (
          <ShelfCard key={shelf._id} shelf={shelf} busy={busy} onRename={renameShelf} onDelete={deleteShelf} onRemoveItem={removeItem} />
        ))}
      </div>
    </section>
  );
}
