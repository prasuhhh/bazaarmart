import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import Thumb from '../components/ui/Thumb.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

export default function SignIn() {
  const { user, login } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const location = useLocation();
  const [mode, setMode] = useState(location.state?.mode === 'register' ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const isRegistering = mode === 'register';

  // This redirect also handles the move onward after a successful sign-in.
  if (user) return <Navigate to={location.state?.from || '/map'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    clearNotice();
    try {
      if (isRegistering) {
        const { message } = await api('/users', { method: 'POST', body: { ...body, age: Number(body.age) } });
        showSuccess(message);
        form.reset();
        setMode('login');
      } else {
        const { message, data } = await api('/login', { method: 'POST', body });
        showSuccess(message, { keep: true });
        login(data.token, data.user);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin-art"><Thumb /></div>
      <section className="signin-card">
        <p className="caption">Entry pass</p>
        <h2>Walk in.</h2>
        <form key={mode} className="form-grid" onSubmit={handleSubmit}>
          {isRegistering && <label>Username<input name="username" minLength="2" autoComplete="name" required /></label>}
          <label>Email ID<input name="emailId" type="email" autoComplete="email" required /></label>
          {isRegistering && <label>Age<input name="age" type="number" min="1" max="120" required /></label>}
          <label>Password<input name="password" type="password" minLength={isRegistering ? 6 : undefined} autoComplete={isRegistering ? 'new-password' : 'current-password'} required /></label>
          <button className="primary" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="muted signin-switch">
          {isRegistering ? 'Already have a pass? ' : 'New here? '}
          <button type="button" className="link-button" onClick={() => setMode(isRegistering ? 'login' : 'register')}>
            {isRegistering ? 'Sign in' : 'Create account'}
          </button>
        </p>
      </section>
    </div>
  );
}
