import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { showSuccess } = useNotice();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    showSuccess('You have been logged out.', { keep: true });
    navigate('/login');
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">S</span>
        <span>
          <strong>BazaarMart</strong>
          <small>CS3801 · MERN Shopping Application</small>
        </span>
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <NavLink to="/products">Products</NavLink>
            <NavLink to="/cart">Cart{itemCount > 0 && <span className="badge">{itemCount}</span>}</NavLink>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/profile">Profile</NavLink>
            {user.role === 'admin' && <NavLink to="/admin/products">Admin</NavLink>}
            <button className="outline" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
