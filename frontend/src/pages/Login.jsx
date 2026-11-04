import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  // This redirect also handles the move to the next page after a successful login.
  if (user) return <Navigate to={location.state?.from || '/products'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    clearNotice();
    try {
      const { message, data } = await api('/login', { method: 'POST', body });
      showSuccess(message, { keep: true });
      login(data.token, data.user);
    } catch (error) {
      showError(error.message);
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <h3 className="card-title">Sign in</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>Email ID<input name="emailId" type="email" placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" placeholder="Your password" required /></label>
        <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
      </form>
      <p className="muted switch-link">New here? <Link to="/register">Create an account</Link></p>
    </section>
  );
}
