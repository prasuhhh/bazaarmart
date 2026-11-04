import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// The server enforces every permission; this only decides what to show.
export default function ProtectedRoute({ admin = false }) {
  const { user, signedOut } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/products" replace />;
  return <Outlet />;
}
