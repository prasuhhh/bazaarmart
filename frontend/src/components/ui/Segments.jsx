import { STATUS_STEPS } from '../../orderStatus.js';

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
