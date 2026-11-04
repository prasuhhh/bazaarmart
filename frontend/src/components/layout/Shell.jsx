import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useLiveOrders } from '../../hooks/useLiveOrders.js';
import { useZones } from '../../hooks/useZones.js';
import Notice from '../ui/Notice.jsx';
import ReceiptDrawer from './ReceiptDrawer.jsx';
import Taskbar from './Taskbar.jsx';
import TopBar from './TopBar.jsx';

export default function Shell() {
  const [isTaskbarOpen, setIsTaskbarOpen] = useState(false);
  const { pathname } = useLocation();
  const zones = useZones();
  const liveOrders = useLiveOrders();
  const closeTaskbar = useCallback(() => setIsTaskbarOpen(false), []);

  useEffect(() => {
    setIsTaskbarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isTaskbarOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setIsTaskbarOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isTaskbarOpen]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="frame">
        <Taskbar isOpen={isTaskbarOpen} liveOrders={liveOrders} />
        <div className="workspace">
          <TopBar zones={zones} isTaskbarOpen={isTaskbarOpen} onMenu={() => setIsTaskbarOpen(true)} />
          <main className="page" id="main"><Outlet /></main>
        </div>
      </div>
      {isTaskbarOpen && <button type="button" className="backdrop" aria-label="Close menu" onClick={closeTaskbar} />}
      <ReceiptDrawer />
      <Notice />
    </div>
  );
}
