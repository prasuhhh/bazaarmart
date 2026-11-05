import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';
import LiveOrderCard from './LiveOrderCard.jsx';

export default function Taskbar({ isOpen, liveOrders }) {
  const { user, logout } = useAuth();
  const { showSuccess } = useNotice();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [closestOrder] = liveOrders;

  const items = [
    { label: 'Store map', to: '/map', match: '/map' },
    { label: 'Browse zone', to: '/zone', match: '/zone' },
    { label: 'Product sheet', to: '/p', match: '/p' },
    { label: 'Saved shelf', to: '/saved', match: '/saved' },
    { label: 'Counter (checkout)', to: '/counter', match: '/counter' },
    { label: 'Orders', to: '/orders', match: '/orders', badge: liveOrders.length || null },
    { label: 'Track parcel', to: closestOrder ? `/track/${closestOrder.orderNo}` : '/track', match: '/track' },
    { label: 'Profile', to: '/profile', match: '/profile' }
  ];

  const isActive = match => pathname === match || pathname.startsWith(`${match}/`);

  function signOut() {
    logout();
    showSuccess('You have been signed out.', { keep: true });
    navigate('/signin');
  }

  return (
    <aside className={`taskbar${isOpen ? ' open' : ''}`} aria-label="Taskbar">
      <div className="taskbar-inner">
      <Link className="brand" to="/map" aria-label="BazaarMart store map">
        <span className="brand-name">Bazaar<span className="brand-slash">/</span>Mart</span>
        <span className="brand-caption">lifestyle × tech</span>
      </Link>

      <p className="taskbar-caption">TASKBAR</p>
      <nav aria-label="Main">
        <ol className="taskbar-items">
          {items.map(({ label, to, match, badge }, index) => (
            <li key={label}>
              <Link
                to={to}
                title={label}
                className={`taskbar-item${isActive(match) ? ' active' : ''}`}
                aria-current={isActive(match) ? 'page' : undefined}
              >
                <span className="taskbar-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="taskbar-label">{label}</span>
                {badge && <span className="taskbar-badge">{badge}<span className="taskbar-badge-word"> live</span></span>}
              </Link>
            </li>
          ))}
          <li>
            {user ? (
              <button type="button" className="taskbar-item" title="Sign out" onClick={signOut}>
                <span className="taskbar-number">09</span>
                <span className="taskbar-label">Sign out</span>
              </button>
            ) : (
              <Link to="/signin" title="Sign in" className={`taskbar-item${isActive('/signin') ? ' active' : ''}`}>
                <span className="taskbar-number">09</span>
                <span className="taskbar-label">Sign in</span>
              </Link>
            )}
          </li>
          {user?.role === 'admin' && (
            <li>
              <Link to="/admin/products" title="Admin" className={`taskbar-item${isActive('/admin') ? ' active' : ''}`}>
                <span className="taskbar-number">10</span>
                <span className="taskbar-label">Admin</span>
              </Link>
            </li>
          )}
        </ol>
      </nav>

      {closestOrder && <LiveOrderCard order={closestOrder} />}
      </div>
    </aside>
  );
}
