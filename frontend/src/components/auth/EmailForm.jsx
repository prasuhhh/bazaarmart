import { useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';

export default function EmailForm({ startRegistering }) {
  const { login } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const [isRegistering, setIsRegistering] = useState(startRegistering);
  const [busy, setBusy] = useState(false);

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
        setIsRegistering(false);
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
    <>
      <div className="tabs" role="group" aria-label="Email sign in">
        <button type="button" className={`pill${isRegistering ? '' : ' on'}`} aria-pressed={!isRegistering} onClick={() => setIsRegistering(false)}>Sign in</button>
        <button type="button" className={`pill${isRegistering ? ' on' : ''}`} aria-pressed={isRegistering} onClick={() => setIsRegistering(true)}>Create account</button>
      </div>
      <form key={isRegistering ? 'register' : 'login'} className="form-grid" onSubmit={handleSubmit}>
        {isRegistering && <label>Username<input name="username" minLength="2" autoComplete="name" required /></label>}
        <label>Email ID<input name="emailId" type="email" autoComplete="email" required /></label>
        {isRegistering && <label>Age<input name="age" type="number" min="1" max="120" required /></label>}
        <label>Password<input name="password" type="password" minLength={isRegistering ? 6 : undefined} autoComplete={isRegistering ? 'new-password' : 'current-password'} required /></label>
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
      </form>
    </>
  );
}
