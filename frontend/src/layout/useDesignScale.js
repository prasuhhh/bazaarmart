import { useLayoutEffect } from 'react';

const DESIGN_W = 1280;
const DESIGN_H = 908;
const MIN_W = 1000; // below this the drawer layout takes over at normal size
const FIT_MODE = 'width'; // 'width' fills the window and scrolls; 'contain' fits the whole 1280 × 908 canvas

// Every desktop page is built at 1280 design px. Scaling the root keeps 1280 equal to the
// window width on any screen, and cancels out browser zoom because that changes the width too.
function applyScale() {
  const root = document.documentElement;
  const width = root.clientWidth;
  const height = window.innerHeight;
  const isCompact = width < MIN_W;
  const isContain = !isCompact && FIT_MODE === 'contain';
  const scale = isCompact ? 1 : isContain ? Math.min(width / DESIGN_W, height / DESIGN_H) : width / DESIGN_W;

  root.classList.toggle('is-compact', isCompact);
  root.classList.toggle('is-contain', isContain);
  root.style.zoom = scale;
  root.style.setProperty('--s', scale);
  root.style.setProperty('--vh-design', `${height / scale}px`);
}

export function useDesignScale() {
  useLayoutEffect(() => {
    let frame = null;
    const scheduleScale = () => {
      if (frame === null) frame = requestAnimationFrame(() => { frame = null; applyScale(); });
    };
    applyScale();
    window.addEventListener('resize', scheduleScale);
    return () => {
      window.removeEventListener('resize', scheduleScale);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
}
