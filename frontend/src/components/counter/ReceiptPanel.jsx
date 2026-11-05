import { useState } from 'react';
import { formatPrice } from '../../formatPrice.js';

function Line({ label, value }) {
  return <p className="receipt-sum"><span>{label}</span><span>{value}</span></p>;
}

// `lineList` replaces the plain lines, and `onEdit` links an error back to where they're edited.
export default function ReceiptPanel({
  items, heading = '— Receipt —', headerLink, lineList, afterPay, onEdit, quoted, coupon, onCoupon, blockedBy, busy, onPay
}) {
  const { quote, error, isReady } = quoted;
  const [code, setCode] = useState('');
  const lines = isReady ? quote.lines : items.map(item => ({ ...item, name: item.productName }));
  const amount = value => (isReady ? formatPrice(value) : '…');

  function applyCoupon(event) {
    event.preventDefault();
    onCoupon(code.trim());
    setCode('');
  }

  return (
    <aside className="receipt-panel" aria-label="Receipt">
      <h3>{heading}</h3>
      {headerLink}
      {lineList ?? (
        <ul className="receipt-lines">
          {lines.map(line => (
            <li key={`${line.productId}:${line.colour}`}>
              <span>{line.productId} {line.name}{line.qty > 1 && ` × ${line.qty}`}{line.colour && <small>{line.colour}</small>}</span>
              <span>{formatPrice(line.price * line.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <Line label="Subtotal" value={amount(quote?.subtotal)} />
      <Line label="Delivery" value={isReady && quote.delivery === 0 ? 'Free' : amount(quote?.delivery)} />
      <Line label={quote?.couponCode ? `Coupon ${quote.couponCode}` : 'Coupon'} value={isReady && quote.coupon ? `−${formatPrice(quote.coupon)}` : amount(0)} />
      <p className="receipt-total"><span>TOTAL</span><span>{amount(quote?.total)}</span></p>

      {coupon ? (
        <button type="button" className="link-button" onClick={() => onCoupon('')}>Remove coupon</button>
      ) : (
        <form className="inline-form" onSubmit={applyCoupon}>
          <input value={code} onChange={event => setCode(event.target.value)} placeholder="Coupon code" aria-label="Coupon code" />
          <button className="outline" disabled={!code.trim()}>Apply</button>
        </form>
      )}

      {error && (
        <p className="receipt-error" role="alert">
          {error.message} {onEdit && <button type="button" className="link-button" onClick={onEdit}>Edit receipt</button>}
        </p>
      )}
      <button type="button" className="primary pay-button" disabled={!isReady || Boolean(blockedBy) || busy} onClick={onPay}>
        {busy ? 'Please wait…' : isReady ? `Pay ${formatPrice(quote.total)}` : 'Pay'}
      </button>
      {blockedBy && <p className="field-help">{blockedBy}</p>}
      {afterPay}
    </aside>
  );
}
