import { useParams } from 'react-router-dom';
import ProductGrid from '../components/shop/ProductGrid.jsx';
import ShelfCheckoutButton from '../components/shop/ShelfCheckoutButton.jsx';
import ShelfItem, { toReceiptEntry } from '../components/shop/ShelfItem.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useMoveToReceipt } from '../hooks/useMoveToReceipt.js';
import Placeholder from './Placeholder.jsx';

// Public, so it shows nothing about the shelf's owner. Buying works; changing it doesn't.
export default function SharedShelf() {
  const { shareId } = useParams();
  const { data: shelf, error } = useFetch(`/shelves/shared/${encodeURIComponent(shareId)}`);
  const moveToReceipt = useMoveToReceipt();

  if (error?.status === 404) {
    return <Placeholder caption="Shared shelf" title="This shelf has been cleared." linkTo="/map" linkLabel="Walk the store">The link may be old, or its owner may have removed the shelf.</Placeholder>;
  }
  if (error) return <p className="empty">{error.message}</p>;
  if (!shelf) return <p className="empty">Finding the shelf…</p>;

  return (
    <section className="saved">
      <article className="shelf-card">
        <header className="shelf-head">
          <h3>{shelf.name}</h3>
          <span className="caption">Shared shelf</span>
        </header>
        {shelf.items.length
          ? <ProductGrid as="ul">{shelf.items.map(item => <ShelfItem key={item.productId} item={item} />)}</ProductGrid>
          : <p className="muted shelf-empty">This shelf is empty.</p>}
        <footer className="shelf-foot">
          <ShelfCheckoutButton items={shelf.items} to={`/counter?share=${encodeURIComponent(shareId)}`} />
          <button type="button" className="shelf-move" disabled={!shelf.items.length} onClick={() => moveToReceipt(shelf.items.map(toReceiptEntry))}>
            Move whole shelf to receipt
          </button>
        </footer>
      </article>
    </section>
  );
}
