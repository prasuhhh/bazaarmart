import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  return (
    <section className="intro">
      <span className="eyebrow">YOUR EVERYDAY STORE</span>
      <h2>A simple, secure shopping experience.</h2>
      <p>Browse the catalogue, fill your cart, and track your orders in one place.</p>
      <div className="hero-actions">
        {user ? (
          <Link className="primary" to="/products">Browse products</Link>
        ) : (
          <>
            <Link className="primary" to="/register">Create account</Link>
            <Link className="outline" to="/login">Sign in</Link>
          </>
        )}
      </div>
    </section>
  );
}
