import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { lineIdOf, useReceipt } from '../../context/ReceiptContext.jsx';
import { formatPrice } from '../../formatPrice.js';
import Stepper from '../ui/Stepper.jsx';
import Thumb from '../ui/Thumb.jsx';

export default function ReceiptDrawer() {
  const { items, isOpen, closeReceipt, setQty, removeItem, subtotal } = useReceipt();
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const closeOnEscape = event => { if (event.key === 'Escape') closeReceipt(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      openerRef.current?.focus?.();
    };
  }, [isOpen, closeReceipt]);

  return (
    <>
      {isOpen && <button type="button" className="backdrop" aria-label="Close receipt" onClick={closeReceipt} />}
      <aside className={`receipt-drawer${isOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Receipt">
        <div className="drawer-header">
          <h2>Receipt</h2>
          <button type="button" ref={closeRef} className="drawer-close" onClick={closeReceipt}>Close</button>
        </div>

        {items.length ? (
          <ul className="drawer-lines">
            {items.map(line => (
              <li className="drawer-line" key={lineIdOf(line)}>
                <Thumb src={line.image} />
                <div>
                  <p className="drawer-line-name">{line.productName}{line.colour && ` · ${line.colour}`}</p>
                  <Stepper name={line.productName} qty={line.qty} max={line.stock} onChange={qty => setQty(lineIdOf(line), qty)} />
                </div>
                <div>
                  <p className="drawer-line-price">{formatPrice(line.price * line.qty)}</p>
                  <button type="button" className="link-button" aria-label={`Remove ${line.productName}`} onClick={() => removeItem(lineIdOf(line))}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="drawer-empty">Your receipt is empty. Add something from the store floor.</p>
        )}

        <div className="drawer-footer">
          <p className="drawer-subtotal"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></p>
          <Link className="primary" to="/counter" onClick={closeReceipt}>Go to counter</Link>
        </div>
      </aside>
    </>
  );
}
