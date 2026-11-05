import { Link } from 'react-router-dom';

export default function ZoneTile({ zone, span: [columns, rows], isActive, onPeek }) {
  return (
    <Link
      className={`zone-tile${isActive ? ' active' : ''}`}
      to={`/zone/${zone.code}`}
      style={{ '--columns': columns, '--rows': rows }}
      aria-label={`Zone ${zone.code}, ${zone.name}, ${zone.totalStock} in stock`}
      onMouseEnter={() => onPeek(zone.code)}
      onFocus={() => onPeek(zone.code)}
    >
      <span className="caption">Zone {zone.code}</span>
      <strong>{zone.name}</strong>
    </Link>
  );
}
