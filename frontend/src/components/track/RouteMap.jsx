import { useLayoutEffect, useRef, useState } from 'react';

const VIEW = { width: 800, height: 500 };
const ROUTE = 'M70 430 C 200 380, 300 230, 430 225 S 540 300, 620 262 S 700 150, 740 70';
const PROGRESS = { placed: 0, packed: 0.12, shipped: 0.45, out_for_delivery: 0.78, delivered: 1, returned: 0 };
const MARKER_LABELS = { delivered: 'Delivered', returned: 'Back at warehouse' };

const percent = ({ x, y }) => ({ left: `${(x / VIEW.width) * 100}%`, top: `${(y / VIEW.height) * 100}%` });

// A drawn route, not GPS: the marker's place along the line comes from the order's status.
export default function RouteMap({ status }) {
  const routeRef = useRef(null);
  const [point, setPoint] = useState(null);
  const progress = PROGRESS[status];

  useLayoutEffect(() => {
    const route = routeRef.current;
    if (progress === undefined) setPoint(null);
    else setPoint(route.getPointAtLength(route.getTotalLength() * progress));
  }, [progress]);

  return (
    <div className="route-map" role="img" aria-label={`Simulated delivery route. Parcel status: ${status.replaceAll('_', ' ')}.`}>
      <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} preserveAspectRatio="none" aria-hidden="true">
        <path ref={routeRef} d={ROUTE} />
      </svg>
      <span className="route-label" style={percent({ x: 70, y: 430 })}>● Warehouse</span>
      <span className="route-label" style={percent({ x: 740, y: 70 })}>⌂ You</span>
      {point && (
        <span className="route-marker" data-progress={progress} style={percent(point)}>
          ▲ {MARKER_LABELS[status] ?? 'Parcel now'}
        </span>
      )}
      {progress === undefined && <span className="route-note">This parcel was cancelled.</span>}
    </div>
  );
}
