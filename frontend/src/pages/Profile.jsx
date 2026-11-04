import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotice } from '../context/NoticeContext.jsx';

const ROLE_LABELS = { admin: 'Admin', user: 'Customer' };

function initialsOf(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0].toUpperCase()).join('');
}

function SettingsSection({ title, description, danger = false, children }) {
  return (
    <section className={`panel settings-section${danger ? ' danger-zone' : ''}`}>
      <div className="settings-intro">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const { showSuccess, showError, clearNotice } = useNotice();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user.username);
  const [age, setAge] = useState(String(user.age));
  const [busyWith, setBusyWith] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const usersPath = `/users?emailId=${encodeURIComponent(user.emailId)}`;
  const busy = busyWith !== null;
  const detailsChanged = username.trim() !== user.username || Number(age) !== user.age;

  async function run(action, task) {
    setBusyWith(action);
    clearNotice();
    try {
      await task();
    } catch (error) {
      if (error.status !== 401) showError(error.message);
    } finally {
      setBusyWith(null);
    }
  }

  function saveDetails(event) {
    event.preventDefault();
    run('details', async () => {
      const body = { username: username.trim(), age: Number(age) };
      const { message, data } = await api(usersPath, { method: 'PUT', body });
      updateUser(data);
      setUsername(data.username);
      setAge(String(data.age));
      showSuccess(message);
    });
  }

  function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { password, confirmPassword } = Object.fromEntries(new FormData(form).entries());
    if (password !== confirmPassword) {
      showError('The two passwords do not match.');
      return;
    }
    run('password', async () => {
      await api(usersPath, { method: 'PATCH', body: { password } });
      form.reset();
      showSuccess('Your password has been updated.');
    });
  }

  function deleteAccount() {
    run('delete', async () => {
      const { message } = await api(usersPath, { method: 'DELETE' });
      logout();
      showSuccess(message, { keep: true });
      navigate('/login');
    });
  }

  return (
    <div className="account">
      <div className="section-heading">
        <div><span className="eyebrow">ACCOUNT</span><h3>Account settings</h3></div>
      </div>

      <header className="panel account-header">
        <span className="avatar" aria-hidden="true">{initialsOf(user.username)}</span>
        <div className="account-identity">
          <strong>{user.username}</strong>
          <span>{user.emailId}</span>
        </div>
        <span className="category">{ROLE_LABELS[user.role] || ROLE_LABELS.user}</span>
      </header>

      <SettingsSection title="Personal details" description="Update the name and age on your account.">
        <form className="form-grid" aria-label="Personal details" onSubmit={saveDetails}>
          <label>Username<input name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="name" required minLength="2" /></label>
          <label>Age<input name="age" type="number" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} required /></label>
          <label className="full">
            Email ID
            <input value={user.emailId} disabled />
            <span className="field-help">Your email identifies your account and can't be changed.</span>
          </label>
          <div className="form-footer full">
            <button className="primary" disabled={busy || !detailsChanged}>{busyWith === 'details' ? 'Please wait…' : 'Save changes'}</button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Password" description="Use at least 6 characters. You'll stay signed in on this device.">
        <form className="form-grid" aria-label="Change password" onSubmit={changePassword}>
          <label>New password<input name="password" type="password" minLength="6" autoComplete="new-password" required /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" minLength="6" autoComplete="new-password" required /></label>
          <div className="form-footer full">
            <button className="primary" disabled={busy}>{busyWith === 'password' ? 'Please wait…' : 'Update password'}</button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Delete account" description="This permanently removes your account and can't be undone." danger>
        {confirmingDelete ? (
          <div className="delete-confirm" role="group" aria-label="Confirm account deletion">
            <p>Are you sure you want to delete your account?</p>
            <div className="form-footer">
              <button className="outline" disabled={busy} onClick={() => setConfirmingDelete(false)}>Keep my account</button>
              <button className="danger solid" disabled={busy} onClick={deleteAccount}>{busyWith === 'delete' ? 'Please wait…' : 'Yes, delete my account'}</button>
            </div>
          </div>
        ) : (
          <div className="form-footer no-margin">
            <button className="danger" onClick={() => setConfirmingDelete(true)}>Delete account</button>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
