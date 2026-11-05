import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useReceipt } from '../../context/ReceiptContext.jsx';
import { useAddToReceipt } from '../../hooks/useAddToReceipt.js';
import { useDragToReceipt } from '../../hooks/useDragToReceipt.js';
import { useFetch } from '../../hooks/useFetch.js';
import Thumb from '../ui/Thumb.jsx';
import PriceChip from './PriceChip.jsx';

const DESIGN_PX_PER_SECOND = 40;
const LONGEST_FRAME_MS = 100; // a tab coming back shouldn't jump the belt forward
const OUT_OF_STEP_PX = 1; // further than rounding: someone else moved the belt

const prefersStillness = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// `isCopy` marks the second run of cards that makes the loop seamless.
function ConveyorCard({ product, isCopy }) {
  const { qtyOf } = useReceipt();
  const addToReceipt = useAddToReceipt();
  const isUnavailable = qtyOf(product.productId) >= product.quantity;
  const { drag, dragProps } = useDragToReceipt(() => { if (!isUnavailable) addToReceipt(product); });
  const image = product.images?.[0];
  const hiddenProps = isCopy ? { tabIndex: -1 } : {};

  return (
    <li className="conveyor-card" aria-hidden={isCopy || undefined}>
      <Link to={`/p/${product.productId}`} draggable={false} aria-label={product.productName} {...hiddenProps} {...dragProps}>
        <Thumb src={image} />
      </Link>
      <div className="product-foot">
        <PriceChip value={product.productPrice} />
        <button type="button" className="icon-button" aria-label={`Add ${product.productName} to receipt`} disabled={isUnavailable} onClick={() => addToReceipt(product)} {...hiddenProps}>+</button>
      </div>
      {drag && createPortal(
        <div className="drag-ghost" style={{ left: `calc(${drag.x}px / var(--s, 1))`, top: `calc(${drag.y}px / var(--s, 1))` }}><Thumb src={image} /></div>,
        document.body
      )}
    </li>
  );
}

// Keeps the belt moving until something holds it, and wraps it round one run of cards.
function useBeltMotion(beltRef, cardCount, speed, isMoving) {
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const belt = beltRef.current;
    if (!isMoving || !belt) return undefined;

    const runWidth = () => belt.children[cardCount].offsetLeft - belt.children[0].offsetLeft;
    const isHeld = () => isHoveredRef.current || document.hidden || 'dragging' in document.body.dataset || belt.matches(':focus-within');
    const wrapForward = () => { if (belt.scrollLeft >= runWidth()) belt.scrollLeft -= runWidth(); };
    const wrapBackward = event => { if (belt.scrollLeft + event.deltaX <= 0) belt.scrollLeft += runWidth(); };

    let position = belt.scrollLeft;
    let lastTime = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = Math.min(now - lastTime, LONGEST_FRAME_MS);
      lastTime = now;
      if (Math.abs(belt.scrollLeft - position) > OUT_OF_STEP_PX) position = belt.scrollLeft;
      if (!isHeld()) {
        position += (speed * elapsed) / 1000;
        if (position >= runWidth()) position -= runWidth();
        belt.scrollLeft = position;
      }
      frame = requestAnimationFrame(tick);
    });

    belt.addEventListener('scroll', wrapForward, { passive: true });
    belt.addEventListener('wheel', wrapBackward, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      belt.removeEventListener('scroll', wrapForward);
      belt.removeEventListener('wheel', wrapBackward);
    };
  }, [beltRef, cardCount, speed, isMoving]);

  return { onPointerEnter: () => { isHoveredRef.current = true; }, onPointerLeave: () => { isHoveredRef.current = false; } };
}

export default function Conveyor({ speed = DESIGN_PX_PER_SECOND }) {
  const { data: products, error } = useFetch('/products?isNew=true&sort=new');
  const beltRef = useRef(null);
  const [loops, setLoops] = useState(false);
  const hoverProps = useBeltMotion(beltRef, products?.length ?? 0, speed, loops);

  // Too few cards to fill the row, or a request for stillness, leaves a plain row.
  useLayoutEffect(() => {
    const belt = beltRef.current;
    setLoops(Boolean(products?.length) && belt.scrollWidth > belt.clientWidth && !prefersStillness());
  }, [products]);

  return (
    <section className="map-section" aria-label="New drops">
      <p className="caption">Conveyor · new drops · drag onto receipt</p>
      {error && <p className="muted">{error.message}</p>}
      <ul className="conveyor" ref={beltRef} {...hoverProps}>
        {products?.map(product => <ConveyorCard key={product.productId} product={product} />)}
        {loops && products.map(product => <ConveyorCard key={`${product.productId}-copy`} product={product} isCopy />)}
      </ul>
    </section>
  );
}
