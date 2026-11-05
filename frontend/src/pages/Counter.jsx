import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CounterDesk from '../components/counter/CounterDesk.jsx';
import ShelfLines from '../components/counter/ShelfLines.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';
import { useReceipt } from '../context/ReceiptContext.jsx';
import { useShelfCheckout } from '../hooks/useShelfCheckout.js';
import Placeholder from './Placeholder.jsx';

const SHELF_MISSING = [400, 403, 404];

function ReceiptCounter() {
  const { items, clearReceipt, openReceipt } = useReceipt();

  if (!items.length) {
    return (
      <Placeholder caption="Counter" title="Your receipt is empty." linkTo="/map" linkLabel="Walk the store">
        Add something from the store floor, then come back to the counter.
      </Placeholder>
    );
  }
  return <CounterDesk items={items} panel={{ onEdit: openReceipt }} onPlaced={clearReceipt} />;
}

function ShelfCounter({ shelfId, shareId }) {
  const { user, signedOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showInfo } = useNotice();
  const mustSignIn = Boolean(shelfId) && !user;
  const { shelfName, lines, items, error, pick, setAllQty } = useShelfCheckout(mustSignIn ? {} : { shelfId, shareId });
  const [removeOrdered, setRemoveOrdered] = useState(false);
  const backTo = shelfId ? '/saved' : `/s/${encodeURIComponent(shareId)}`;
  const isEmpty = lines?.length === 0;

  useEffect(() => {
    if (!isEmpty) return;
    showInfo('This shelf is empty', { keep: true });
    navigate(backTo, { replace: true });
  }, [isEmpty, backTo, navigate, showInfo]);

  if (mustSignIn) {
    return <Navigate to="/signin" replace state={signedOut ? null : { from: `${location.pathname}${location.search}` }} />;
  }
  if (error && SHELF_MISSING.includes(error.status)) {
    return shelfId
      ? <Placeholder caption="Counter" title="That shelf isn't yours or no longer exists" linkTo="/saved" linkLabel="Back to your shelves">Pick one of your own shelves to check out.</Placeholder>
      : <Placeholder caption="Counter" title="This shelf has been cleared." linkTo="/map" linkLabel="Walk the store">The link may be old, or its owner may have removed the shelf.</Placeholder>;
  }
  if (error) return <p className="empty">{error.message}</p>;
  if (!lines || isEmpty) return <p className="empty">Finding the shelf…</p>;

  const panel = {
    heading: `Receipt · from shelf “${shelfName}”`,
    headerLink: <Link className="pill shelf-back" to={backTo}>Back to shelf</Link>,
    lineList: <ShelfLines lines={lines} onPick={pick} onSetAll={setAllQty} />,
    afterPay: shelfId && (
      <label className="shelf-remove">
        <input type="checkbox" checked={removeOrdered} onChange={event => setRemoveOrdered(event.target.checked)} />
        Remove ordered items from this shelf
      </label>
    )
  };
  const orderFields = {
    source: { type: 'shelf', ...(shelfId ? { shelfId } : { shareId }) },
    ...(removeOrdered && { removeFromShelf: true })
  };
  return <CounterDesk items={items} panel={panel} orderFields={orderFields} />;
}

export default function Counter() {
  const [params] = useSearchParams();
  const shelfId = params.get('shelf');
  const shareId = params.get('share');

  if (shelfId) return <ShelfCounter key={shelfId} shelfId={shelfId} />;
  if (shareId) return <ShelfCounter key={shareId} shareId={shareId} />;
  return <ReceiptCounter />;
}
