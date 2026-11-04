import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';

// `children` holds any extra fields, such as the star rating.
export default function FeedbackForm({ path, label, button, signInText, onPosted, children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { showSuccess, showError } = useNotice();
  const [busy, setBusy] = useState(false);

  if (!user) return <Link className="link-button" to="/signin" state={{ from: pathname }}>{signInText}</Link>;

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { rating, text } = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    try {
      const { message } = await api(path, { method: 'POST', body: { text, ...(rating && { rating: Number(rating) }) } });
      showSuccess(message);
      form.reset();
      onPosted();
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="feedback-form" onSubmit={handleSubmit}>
      {children}
      <textarea name="text" rows="2" maxLength="500" aria-label={label} placeholder={label} required />
      <button className="outline" disabled={busy}>{busy ? 'Please wait…' : button}</button>
    </form>
  );
}
