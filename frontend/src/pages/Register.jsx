import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

export default function Register() {
  const { user } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/products" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.age = Number(body.age);
    setBusy(true);
    clearNotice();
    try {
      const { message } = await api('/users', { method: 'POST', body });
      showSuccess(message, { keep: true });
      navigate('/login');
    } catch (error) {
      showError(error.message);
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <h3 className="card-title">Create your account</h3>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>Username<input name="username" placeholder="Your name" minLength="2" required /></label>
        <label>Email ID<input name="emailId" type="email" placeholder="you@example.com" required /></label>
        <label>Age<input name="age" type="number" min="1" max="120" placeholder="Age" required /></label>
        <label>Password<input name="password" type="password" minLength="6" placeholder="At least 6 characters" required /></label>
        <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : 'Create account'}</button>
      </form>
      <p className="muted switch-link">Already registered? <Link to="/login">Sign in</Link></p>
    </section>
  );
}
