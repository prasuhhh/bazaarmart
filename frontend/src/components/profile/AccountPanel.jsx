import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotice } from '../../context/NoticeContext.jsx';
import { useAction } from '../../hooks/useAction.js';
import Modal from '../ui/Modal.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

const clean = values => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));

function ProfileForm({ profile, method, busy, onSubmit }) {
  const isFull = method === 'PUT';
  function handleSubmit(event) {
    event.preventDefault();
    const values = clean(Object.fromEntries(new FormData(event.currentTarget).entries()));
    onSubmit({ ...values, ...(values.age && { age: Number(values.age) }) });
  }
  return (
    <form className="form-grid modal-form" onSubmit={handleSubmit}>
      <label className="full">Email ID
        {profile.emailId
          ? <input value={profile.emailId} disabled />
          : <input name="emailId" type="email" autoComplete="email" />}
        {profile.emailId && <span className="field-help">Your email identifies your account and can't be changed.</span>}
      </label>
      <label>Username<input name="username" defaultValue={profile.username} minLength="2" autoComplete="name" required={isFull} /></label>
      <label>Age<input name="age" type="number" min="1" max="120" defaultValue={profile.age} required={isFull} /></label>
      <label className="full">{isFull ? 'Password' : 'New password (optional)'}
        <input name="password" type="password" minLength="6" autoComplete="new-password" required={isFull} />
      </label>
      <div className="form-actions full"><button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Save'}</button></div>
    </form>
  );
}

export default function AccountPanel({ profile, onChanged }) {
  const { logout, updateUser } = useAuth();
  const { showSuccess } = useNotice();
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [dialog, setDialog] = useState(null); // 'PUT', 'PATCH' or 'DELETE'

  // Lab routes go by ?emailId=. A phone-only account has no email, so it uses its session.
  const path = profile.emailId ? `/users?emailId=${encodeURIComponent(profile.emailId)}` : '/users/me';
  const close = () => setDialog(null);

  async function save(body) {
    const done = await run(async () => {
      const result = await api(path, { method: dialog, body });
      updateUser(result.data);
      return result;
    });
    if (done) {
      close();
      onChanged();
    }
  }

  function leave(message) {
    logout();
    showSuccess(message, { keep: true });
    navigate('/signin');
  }

  async function deleteAccount() {
    const message = 'User registration deleted successfully.';
    if (await run(() => api(path, { method: 'DELETE' }), message)) leave(message);
  }

  return (
    <ProfilePanel title="Account">
      {profile.emailId && (
        <PanelRow label="Edit profile" detail="Replace name, age and password">
          <button type="button" className="link-button" onClick={() => setDialog('PUT')}>Edit</button>
        </PanelRow>
      )}
      <PanelRow label={profile.emailId ? 'Quick edit' : 'Complete your profile'} detail={profile.emailId ? 'Change only what you fill in' : 'Add your name and email'}>
        <button type="button" className="link-button" onClick={() => setDialog('PATCH')}>Edit</button>
      </PanelRow>
      <PanelRow label="Sign out">
        <button type="button" className="link-button" onClick={() => leave('You have been signed out.')}>Sign out</button>
      </PanelRow>
      <PanelRow label="Delete account" detail="This can't be undone">
        <button type="button" className="link-button danger-link" onClick={() => setDialog('DELETE')}>Delete</button>
      </PanelRow>

      {(dialog === 'PUT' || dialog === 'PATCH') && (
        <Modal title={dialog === 'PUT' ? 'Edit profile' : profile.emailId ? 'Quick edit' : 'Complete your profile'} onClose={close}>
          <ProfileForm profile={profile} method={dialog} busy={busy} onSubmit={save} />
        </Modal>
      )}
      {dialog === 'DELETE' && (
        <Modal title="Delete account" onClose={close}>
          <p className="muted">This permanently removes your account and your shelves, and their share links stop working. Your past orders stay on record.</p>
          <div className="form-actions">
            <button type="button" className="outline" onClick={close}>Keep my account</button>
            <button type="button" className="danger solid" disabled={busy} onClick={deleteAccount}>{busy ? 'Please wait…' : 'Yes, delete my account'}</button>
          </div>
        </Modal>
      )}
    </ProfilePanel>
  );
}
