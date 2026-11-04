import { useState } from 'react';

const NOTE_MAX_LENGTH = 200;

export default function ExtrasStrip({ extras, onChange }) {
  const [isNoteOpen, setIsNoteOpen] = useState(Boolean(extras.note));
  const update = changes => onChange({ ...extras, ...changes });

  return (
    <section className="dashed-box extras" aria-label="Gift wrap, note and GST invoice">
      <div className="extras-toggles">
        <button type="button" className={`extra-toggle${extras.wrap ? ' on' : ''}`} aria-pressed={extras.wrap} onClick={() => update({ wrap: !extras.wrap })}>Gift wrap</button>
        <span aria-hidden="true">·</span>
        <button type="button" className={`extra-toggle${isNoteOpen ? ' on' : ''}`} aria-expanded={isNoteOpen} onClick={() => setIsNoteOpen(current => !current)}>Note</button>
        <span aria-hidden="true">·</span>
        <button type="button" className={`extra-toggle${extras.gst ? ' on' : ''}`} aria-pressed={extras.gst} onClick={() => update({ gst: !extras.gst })}>GST invoice</button>
      </div>
      {(isNoteOpen || extras.gst) && (
        <div className="form-grid extras-fields">
          {isNoteOpen && (
            <label className="full">Note ({NOTE_MAX_LENGTH - extras.note.length} left)
              <textarea rows="2" maxLength={NOTE_MAX_LENGTH} value={extras.note} onChange={event => update({ note: event.target.value })} />
            </label>
          )}
          {extras.gst && (
            <label className="full">GSTIN
              <input value={extras.gstin} maxLength="15" onChange={event => update({ gstin: event.target.value.toUpperCase() })} />
            </label>
          )}
        </div>
      )}
    </section>
  );
}
