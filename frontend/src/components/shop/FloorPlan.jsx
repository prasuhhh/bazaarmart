import ZoneTile from './ZoneTile.jsx';

// The wireframe's tiles, as [columns, rows] of the 7 × 5 grid, in floor order.
const SPANS = [[2, 2], [2, 2], [3, 2], [3, 2], [2, 2], [2, 1], [2, 1], [2, 1], [1, 1]];
const areaOf = ([columns, rows]) => columns * rows;

// Size = stock: the fullest zones take the largest tiles. Zones sharing a tile size
// stay in catalogue order, so the floor keeps its layout when stock shifts a little.
function placeZones(zones) {
  const byStock = [...zones].sort((a, b) => b.totalStock - a.totalStock);
  const placed = [];
  for (const area of [...new Set(SPANS.map(areaOf))].sort((a, b) => b - a)) {
    const slots = SPANS.flatMap((span, index) => (areaOf(span) === area ? [index] : []));
    const members = byStock.splice(0, slots.length).sort((a, b) => zones.indexOf(a) - zones.indexOf(b));
    members.forEach((zone, index) => { placed[slots[index]] = { zone, span: SPANS[slots[index]] }; });
  }
  return [...placed.filter(Boolean), ...byStock.map(zone => ({ zone, span: [1, 1] }))];
}

export default function FloorPlan({ zones, activeCode, onPeek }) {
  return (
    <div className="floor-plan">
      {placeZones(zones).map(({ zone, span }) => (
        <ZoneTile key={zone.code} zone={zone} span={span} isActive={zone.code === activeCode} onPeek={onPeek} />
      ))}
    </div>
  );
}
