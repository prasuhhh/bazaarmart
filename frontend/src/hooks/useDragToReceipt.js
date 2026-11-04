import { useEffect, useRef, useState } from 'react';

const DRAG_START_PX = 6;

const isOverReceipt = (x, y) => Boolean(document.elementFromPoint(x, y)?.closest('[data-receipt-target]'));

// Mouse and pen only: on touch a swipe scrolls the conveyor, and the + button adds.
export function useDragToReceipt(onDrop) {
  const [drag, setDrag] = useState(null);
  const startRef = useRef(null);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!drag) return undefined;
    document.body.dataset.dragging = drag.over ? 'over' : 'on';
    return () => { delete document.body.dataset.dragging; };
  }, [drag]);

  const dragProps = {
    onPointerDown(event) {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      startRef.current = { x: event.clientX, y: event.clientY };
      movedRef.current = false;
    },
    onPointerMove(event) {
      const start = startRef.current;
      if (!start) return;
      const { clientX: x, clientY: y } = event;
      if (!movedRef.current) {
        if (Math.hypot(x - start.x, y - start.y) < DRAG_START_PX) return;
        movedRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setDrag({ x, y, over: isOverReceipt(x, y) });
    },
    onPointerUp(event) {
      if (movedRef.current && isOverReceipt(event.clientX, event.clientY)) onDrop();
      startRef.current = null;
      setDrag(null);
    },
    onPointerCancel() {
      startRef.current = null;
      movedRef.current = false;
      setDrag(null);
    },
    // A drag ends with a click on the card, which mustn't open the product.
    onClickCapture(event) {
      if (!movedRef.current) return;
      movedRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart: event => event.preventDefault()
  };

  return { drag, dragProps };
}
