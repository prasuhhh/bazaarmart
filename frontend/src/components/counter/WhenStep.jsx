import { useMemo, useState } from 'react';
import { dayRange, quickSlots, slotForDay } from './slots.js';

export default function WhenStep({ chosen, onChoose }) {
  const slots = useMemo(() => quickSlots(), []);
  const range = useMemo(() => dayRange(), []);
  const isQuick = slots.some(slot => slot.label === chosen?.label);
  const [isPicking, setIsPicking] = useState(Boolean(chosen) && !isQuick);

  return (
    <div className="choice-row">
      {slots.map(slot => (
        <button type="button" key={slot.label} className={`pill${slot.label === chosen?.label ? ' on' : ''}`} aria-pressed={slot.label === chosen?.label} onClick={() => onChoose(slot)}>{slot.label}</button>
      ))}
      <button type="button" className={`pill${isPicking ? ' on' : ''}`} aria-expanded={isPicking} onClick={() => setIsPicking(current => !current)}>Pick a day</button>
      {isPicking && (
        <label className="day-picker">
          <span className="sr-only">Delivery day</span>
          <input type="date" min={range.min} max={range.max} onChange={event => { if (event.target.value) onChoose(slotForDay(event.target.value)); }} />
        </label>
      )}
    </div>
  );
}
