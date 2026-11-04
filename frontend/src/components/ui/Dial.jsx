import { useEffect, useRef, useState } from 'react';

// A dashed pill that opens a small panel of options.
export default function Dial({ label, isActive, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOutside = event => { if (!rootRef.current?.contains(event.target)) setIsOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') setIsOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="dial" ref={rootRef}>
      <button
        type="button"
        className={`pill${isActive ? ' on' : ''}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >{label}</button>
      {isOpen && <div className="dial-panel">{children}</div>}
    </div>
  );
}
