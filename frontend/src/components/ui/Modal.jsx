import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    const closeOnEscape = event => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      opener?.focus?.();
    };
  }, []);

  return (
    <>
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal" ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="drawer-header">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
}
