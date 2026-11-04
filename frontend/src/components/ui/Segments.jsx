const STATUS_STEPS = { placed: 1, packed: 2, shipped: 3, out_for_delivery: 4, delivered: 5, returned: 5 };
const SEGMENT_COUNT = 5;

export default function Segments({ status }) {
  const filled = STATUS_STEPS[status] ?? 0;
  return (
    <div className="segments" role="img" aria-label={`${filled} of ${SEGMENT_COUNT} steps complete`}>
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
        <span key={index} className={`segment${index < filled ? ' filled' : ''}`} />
      ))}
    </div>
  );
}
