import { useRef, useState } from 'react';
import Thumb from '../ui/Thumb.jsx';

const DRAG_STEP_PX = 40;
const SCALE_VIEWS = { W: 'On wrist', A: 'On desk', D: 'On desk', G: 'On desk', P: 'On desk' };

// Dragging steps through the images. The scale toggle only appears when the last image
// really is a scale view: a lone photo has nothing true to show there.
export default function Gallery({ product }) {
  const images = product.images?.length ? product.images : [undefined];
  const [index, setIndex] = useState(0);
  const dragRef = useRef(null);
  const lastIndex = images.length - 1;
  const credit = product.image?.status === 'ok' ? product.image.attribution : null;
  const hasScaleView = lastIndex > 0 && /-scale\.svg$/.test(images[lastIndex]);
  const scaleLabel = hasScaleView ? SCALE_VIEWS[product.zoneCode] : null;

  function handleMove(event) {
    if (!dragRef.current) return;
    const steps = Math.trunc((event.clientX - dragRef.current.x) / DRAG_STEP_PX);
    if (steps === dragRef.current.steps) return;
    dragRef.current.steps = steps;
    setIndex(((dragRef.current.from + steps) % images.length + images.length) % images.length);
  }

  return (
    <div className={`gallery${lastIndex === 0 ? ' single' : ''}`}>
      {lastIndex > 0 && <div className="gallery-strip">
        {images.map((image, position) => (
          <button
            type="button"
            key={image ?? position}
            className={position === index ? 'on' : ''}
            aria-label={`Photo ${position + 1} of ${images.length}`}
            aria-pressed={position === index}
            onClick={() => setIndex(position)}
          ><Thumb src={image} /></button>
        ))}
      </div>}
      <div className="gallery-view">
      <div
        className="gallery-main"
        onPointerDown={event => {
          if (lastIndex === 0 || event.target.closest('button')) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, from: index, steps: 0 };
        }}
        onPointerMove={handleMove}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        onDragStart={event => event.preventDefault()}
      >
        <Thumb key={images[index] ?? 'none'} src={images[index]} alt={product.productName} />
        {scaleLabel && (
          <button type="button" className="pill scale-toggle" aria-pressed={index === lastIndex} onClick={() => setIndex(index === lastIndex ? 0 : lastIndex)}>
            {index === lastIndex ? 'Full view' : scaleLabel}
          </button>
        )}
      </div>
      {credit && (
        <p className="photo-credit">
          {product.image.sourcePage ? <a href={product.image.sourcePage} target="_blank" rel="noreferrer">{credit}</a> : credit}
        </p>
      )}
      </div>
    </div>
  );
}
