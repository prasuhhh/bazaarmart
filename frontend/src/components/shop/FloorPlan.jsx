import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import ZoneTile from './ZoneTile.jsx';

const SMALLEST_SHARE = 0.05; // of the largest zone, so an empty zone stays readable
const MIN_ROW_PX = 96;
const MIN_COLUMN = 'min(112px, 30%)'; // wide enough to read a zone's name
const ROWS = { wide: 3, phone: 5 };

// Starts a new row once this one holds its share of the stock, keeping the zones in order.
function splitIntoRows(zones, rowCount, weightOf) {
  const target = zones.reduce((sum, zone) => sum + weightOf(zone), 0) / rowCount;
  const rows = [[]];
  let filled = 0;
  for (const zone of zones) {
    rows.at(-1).push(zone);
    filled += weightOf(zone);
    if (filled >= target && rows.length < rowCount) {
      rows.push([]);
      filled = 0;
    }
  }
  return rows.filter(row => row.length);
}

// Column widths follow each zone's share of its row, and row heights follow each
// row's share of the store, so a tile's area follows its stock. Only the minimum
// sizes bend that, for the smallest zones.
export default function FloorPlan({ zones, activeCode, onPeek }) {
  const isPhone = useMediaQuery('(max-width: 519px)');
  const largest = Math.max(...zones.map(zone => zone.totalStock), 1);
  const weightOf = zone => Math.max(zone.totalStock, largest * SMALLEST_SHARE);
  const rows = splitIntoRows(zones, isPhone ? ROWS.phone : ROWS.wide, weightOf);

  return (
    <div
      className="floor-plan"
      style={{
        gridTemplateRows: rows
          .map(row => `minmax(${MIN_ROW_PX}px, ${row.reduce((sum, zone) => sum + weightOf(zone), 0)}fr)`)
          .join(' ')
      }}
    >
      {rows.map(row => (
        <div
          className="floor-row"
          key={row[0].code}
          style={{ gridTemplateColumns: row.map(zone => `minmax(${MIN_COLUMN}, ${weightOf(zone)}fr)`).join(' ') }}
        >
          {row.map(zone => <ZoneTile key={zone.code} zone={zone} isActive={zone.code === activeCode} onPeek={onPeek} />)}
        </div>
      ))}
    </div>
  );
}
