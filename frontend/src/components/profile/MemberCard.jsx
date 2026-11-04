import { formatPrice } from '../../formatPrice.js';
import { useFetch } from '../../hooks/useFetch.js';

const initialsOf = name => (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');

function Stat({ value, label }) {
  return <p className="member-stat"><strong>{value ?? '–'}</strong><span>{label}</span></p>;
}

export default function MemberCard({ profile }) {
  const { data: orders } = useFetch('/orders');
  const { data: shelves } = useFetch('/shelves');
  const kept = orders?.filter(order => order.status !== 'cancelled');
  const saved = kept?.reduce((sum, order) => sum + order.coupon, 0);

  return (
    <header className="member-card">
      <span className="member-avatar" aria-hidden="true">{initialsOf(profile.username)}</span>
      <div className="member-identity">
        <p className="caption">Member card · since {new Date(profile.createdAt).getFullYear()}</p>
        <h2>{profile.username ?? 'New member'}</h2>
        <p className="muted">{[profile.emailId, profile.phone].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="member-stats">
        <Stat value={kept?.length} label="orders" />
        <Stat value={saved === undefined ? undefined : formatPrice(saved)} label="saved" />
        <Stat value={shelves?.length} label="shelves" />
      </div>
    </header>
  );
}
