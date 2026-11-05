import { useNavigate } from 'react-router-dom';

// Goes straight to the counter, so the shelf skips the receipt altogether.
export default function ShelfCheckoutButton({ items, to }) {
  const navigate = useNavigate();
  const hasStock = items.some(item => item.available && item.stock > 0);

  return (
    <>
      <button type="button" className="primary shelf-checkout" disabled={!hasStock} onClick={() => navigate(to)}>
        Check out this shelf →
      </button>
      {!hasStock && items.length > 0 && <p className="field-help">Nothing in stock on this shelf</p>}
    </>
  );
}
