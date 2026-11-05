import { useState } from 'react';
import { formatPrice } from '../../formatPrice.js';
import Stepper from '../ui/Stepper.jsx';

export default function ShelfLines({ lines, onPick, onSetAll }) {
  const [bulkQty, setBulkQty] = useState('1');
  const parsedQty = Number(bulkQty);
  const isBulkValid = Number.isInteger(parsedQty) && parsedQty >= 1;

  function applyBulk(event) {
    event.preventDefault();
    if (isBulkValid) onSetAll(parsedQty);
  }

  return (
    <>
      <form className="shelf-bulk" onSubmit={applyBulk}>
        <label>Set all qty to
          <input type="number" min="1" step="1" value={bulkQty} onChange={event => setBulkQty(event.target.value)} />
        </label>
        <button className="outline" disabled={!isBulkValid}>Set</button>
      </form>

      <ul className="receipt-lines shelf-lines">
        {lines.map(line => (
          <li key={line.productId} className={line.inStock ? undefined : 'out'}>
            <label className="shelf-line-pick">
              <input
                type="checkbox"
                checked={line.isChecked}
                disabled={!line.inStock}
                onChange={event => onPick(line.productId, { isChecked: event.target.checked })}
              />
              <span>{line.productId} {line.name}{!line.inStock && <small>Out of stock</small>}</span>
            </label>
            <span className="shelf-line-amount">
              {line.inStock && <Stepper name={line.name} qty={line.qty} max={line.stock} onChange={qty => onPick(line.productId, { qty })} />}
              <span>{formatPrice(line.price * line.qty)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
