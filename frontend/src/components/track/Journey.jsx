import { JOURNEY, STATUS_LABELS } from '../../orderStatus.js';
import { journeyMoment } from './formatMoment.js';

export default function Journey({ events }) {
  const atOf = status => events.findLast(event => event.status === status)?.at;
  const extras = ['returned', 'cancelled'].filter(atOf);
  // A cancelled order never reaches the later stops, so they aren't shown as waiting.
  const stops = extras.includes('cancelled') ? JOURNEY.filter(atOf) : JOURNEY;

  return (
    <ol className="journey">
      {[...stops, ...extras].map(status => {
        const at = atOf(status);
        return (
          <li key={status} className={at ? 'done' : ''}>
            <span>{STATUS_LABELS[status]}{at && ` · ${journeyMoment(at)}`}</span>
          </li>
        );
      })}
    </ol>
  );
}
