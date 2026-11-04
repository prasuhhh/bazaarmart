import { api } from '../../api/client.js';
import { useAction } from '../../hooks/useAction.js';
import Toggle from '../ui/Toggle.jsx';
import ProfilePanel, { PanelRow } from './ProfilePanel.jsx';

const ROWS = [['orderUpdates', 'Order updates'], ['priceDrops', 'Price drops'], ['newDrops', 'New drops in zones']];

export default function NotificationsPanel({ prefs, onChanged }) {
  const { busy, run } = useAction();

  async function change(key, value) {
    const body = { notificationPrefs: { [key]: value } };
    if (await run(() => api('/users/me/prefs', { method: 'PATCH', body }))) onChanged();
  }

  return (
    <ProfilePanel title="Notifications">
      {ROWS.map(([key, label]) => (
        <PanelRow key={key} label={label}>
          <Toggle label={label} checked={prefs?.[key] ?? true} disabled={busy} onChange={value => change(key, value)} />
        </PanelRow>
      ))}
    </ProfilePanel>
  );
}
