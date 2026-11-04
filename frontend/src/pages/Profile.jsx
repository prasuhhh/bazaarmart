import AccountPanel from '../components/profile/AccountPanel.jsx';
import AddressesPanel from '../components/profile/AddressesPanel.jsx';
import DevicesPanel from '../components/profile/DevicesPanel.jsx';
import MemberCard from '../components/profile/MemberCard.jsx';
import NotificationsPanel from '../components/profile/NotificationsPanel.jsx';
import PaymentsPanel from '../components/profile/PaymentsPanel.jsx';
import StylePanel from '../components/profile/StylePanel.jsx';
import { useFetch } from '../hooks/useFetch.js';

export default function Profile() {
  const { data: profile, error, reload } = useFetch('/users/me');

  if (error && error.status !== 401) return <p className="empty">{error.message}</p>;
  if (!profile) return <p className="empty">Fetching your card…</p>;

  return (
    <div className="profile">
      <MemberCard profile={profile} />
      <div className="profile-grid">
        <AddressesPanel addresses={profile.addresses} onChanged={reload} />
        <PaymentsPanel methods={profile.paymentMethods} onChanged={reload} />
        <DevicesPanel devices={profile.devices} onChanged={reload} />
        <StylePanel prefs={profile.stylePrefs} onChanged={reload} />
        <NotificationsPanel prefs={profile.notificationPrefs} onChanged={reload} />
        <AccountPanel profile={profile} onChanged={reload} />
      </div>
    </div>
  );
}
