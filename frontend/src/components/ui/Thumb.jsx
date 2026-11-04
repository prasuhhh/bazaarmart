import { useState } from 'react';

// Shows the wireframe's crossed box when there's no image or it fails to load.
export default function Thumb({ src, alt = '' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img className="thumb" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;

  return (
    <span className="thumb" role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="0" x2="100" y2="100" />
        <line x1="100" y1="0" x2="0" y2="100" />
      </svg>
    </span>
  );
}
