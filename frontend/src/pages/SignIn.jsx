import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import EmailForm from '../components/auth/EmailForm.jsx';
import PhoneOtpForm from '../components/auth/PhoneOtpForm.jsx';
import Thumb from '../components/ui/Thumb.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

export default function SignIn() {
  const { user } = useAuth();
  const { showError, clearNotice } = useNotice();
  const location = useLocation();
  const startRegistering = location.state?.mode === 'register';
  const [method, setMethod] = useState(startRegistering ? 'email' : 'phone');
  const [busyGoogle, setBusyGoogle] = useState(false);
  const isEmail = method === 'email';

  // This redirect also handles the move onward after a successful sign-in.
  if (user) return <Navigate to={location.state?.from || '/map'} replace />;

  async function tryGoogle() {
    setBusyGoogle(true);
    clearNotice();
    try {
      await api('/auth/google', { method: 'POST', body: {} });
    } catch (error) {
      showError(error.message);
    } finally {
      setBusyGoogle(false);
    }
  }

  return (
    <div className="signin">
      <div className="signin-art"><Thumb /></div>
      <div className="signin-side">
      <section className="signin-card">
        <p className="caption">Entry pass</p>
        <h2>Walk in.</h2>
        {isEmail ? <EmailForm startRegistering={startRegistering} /> : <PhoneOtpForm />}
        <div className="signin-other">
          <button type="button" className="outline" disabled={busyGoogle} onClick={tryGoogle}>
            {busyGoogle ? 'Please wait…' : 'Google'}
          </button>
          <button type="button" className="outline" onClick={() => setMethod(isEmail ? 'phone' : 'email')}>
            {isEmail ? 'Phone' : 'Email'}
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
