import { useState } from 'react';
import { useMoveToReceipt } from '../../hooks/useMoveToReceipt.js';
import { useNotice } from '../../context/NoticeContext.jsx';
import ShelfItem, { toReceiptEntry } from './ShelfItem.jsx';

export default function ShelfCard({ shelf, busy, onRename, onDelete, onRemoveItem }) {
  const moveToReceipt = useMoveToReceipt();
  const { showSuccess, showInfo } = useNotice();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [name, setName] = useState(shelf.name);

  async function copyLink() {
    const link = `${window.location.origin}/s/${shelf.shareId}`;
    try {
      await navigator.clipboard.writeText(link);
      showSuccess('Share link copied.');
    } catch {
      showInfo(`Copy this link: ${link}`);
    }
  }

  async function saveName(event) {
    event.preventDefault();
    if (await onRename(shelf, name)) setIsRenaming(false);
  }

  return (
    <article className="shelf-card">
      <header className="shelf-head">
        {isRenaming ? (
          <form className="inline-form" onSubmit={saveName}>
            <input value={name} maxLength="60" onChange={event => setName(event.target.value)} aria-label="Shelf name" required autoFocus />
            <button className="outline" disabled={busy}>Save</button>
          </form>
        ) : <h3>{shelf.name}</h3>}
        <button type="button" className="caption share-link" onClick={copyLink}>Share</button>
      </header>

      {shelf.items.length ? (
        <ul className="shelf-items">
          {shelf.items.map(item => <ShelfItem key={item.productId} item={item} onRemove={line => onRemoveItem(shelf, line)} />)}
        </ul>
      ) : <p className="muted shelf-empty">Nothing here yet. Tap ☆ on any product to save it.</p>}

      <footer className="shelf-foot">
        <button type="button" className="shelf-move" disabled={!shelf.items.length} onClick={() => moveToReceipt(shelf.items.map(toReceiptEntry))}>
          Move whole shelf to receipt
        </button>
        {isConfirming ? (
          <span className="shelf-actions" role="group" aria-label={`Delete ${shelf.name}?`}>
            <span className="muted">Delete this shelf?</span>
            <button type="button" className="link-button" onClick={() => setIsConfirming(false)}>Keep</button>
            <button type="button" className="link-button danger-link" disabled={busy} onClick={() => onDelete(shelf)}>Delete</button>
          </span>
        ) : (
          <span className="shelf-actions">
            <button type="button" className="link-button" onClick={() => setIsRenaming(current => !current)}>{isRenaming ? 'Cancel' : 'Rename'}</button>
            <button type="button" className="link-button" onClick={() => setIsConfirming(true)}>Delete</button>
          </span>
        )}
      </footer>
    </article>
  );
}
