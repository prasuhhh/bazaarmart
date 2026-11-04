import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';
import OtpInput from '../ui/OtpInput.jsx';

const CODE_LENGTH = 6;
const RESEND_AFTER_SECONDS = 30;
const emptyCode = () => Array(CODE_LENGTH).fill('');

export default function PhoneOtpForm() {
  const { login } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(emptyCode);
  const [isSent, setIsSent] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendCode() {
    setBusy(true);
    clearNotice();
    try {
      const { message, data } = await api('/auth/otp/request', { method: 'POST', body: { phone } });
      showSuccess(message);
      setDevCode(data?.devCode ?? '');
      setDigits(emptyCode());
      setIsSent(true);
      setResendIn(RESEND_AFTER_SECONDS);
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    clearNotice();
    try {
      const { message, data } = await api('/auth/otp/verify', { method: 'POST', body: { phone, code: digits.join('') } });
      showSuccess(message, { keep: true });
      login(data.token, data.user);
    } catch (error) {
      showError(error.message);
      setDigits(emptyCode());
      // Only a wrong code (401) leaves this one usable.
      if (error.status !== 401) setResendIn(0);
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isSent) verifyCode();
    else sendCode();
  }

  function changePhone(event) {
    setPhone(event.target.value);
    setIsSent(false);
    setDevCode('');
    setDigits(emptyCode());
    setResendIn(0);
  }

  const canVerify = digits.every(Boolean);
  return (
    <form className="otp-form" onSubmit={handleSubmit}>
      <input
        className="phone-input"
        value={phone}
        onChange={changePhone}
        type="tel"
        autoComplete="tel"
        placeholder="+91 · phone number"
        aria-label="Phone number"
        required
      />
      <OtpInput digits={digits} onChange={setDigits} disabled={!isSent} />
      {devCode && <p className="mock-sms">Mock SMS · your code is <strong>{devCode}</strong></p>}
      <div className="otp-actions">
        <button className="primary" disabled={busy || (isSent && !canVerify)}>
          {busy ? 'Please wait…' : isSent ? 'Verify' : 'Get OTP'}
        </button>
        {isSent && (
          <button type="button" className="link-button" disabled={busy || resendIn > 0} onClick={sendCode}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        )}
      </div>
    </form>
  );
}
