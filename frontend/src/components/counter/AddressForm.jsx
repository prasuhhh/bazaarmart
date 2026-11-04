const FIELDS = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'phone', label: 'Phone', autoComplete: 'tel', type: 'tel', pattern: '(\\+?91)?[\\s\\-]*[6-9][0-9\\s\\-]{9,12}', title: 'A 10-digit Indian mobile number' },
  { name: 'line1', label: 'Address', autoComplete: 'address-line1', full: true },
  { name: 'line2', label: 'Landmark (optional)', autoComplete: 'address-line2', full: true, optional: true },
  { name: 'city', label: 'City', autoComplete: 'address-level2' },
  { name: 'state', label: 'State', autoComplete: 'address-level1' },
  { name: 'pincode', label: 'Pincode', autoComplete: 'postal-code', inputMode: 'numeric', pattern: '[0-9]{6}', title: '6 digits' }
];

export default function AddressForm({ initial, showLabel, button, busy, onSubmit }) {
  function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    onSubmit(Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim())));
  }

  return (
    <form className="form-grid" aria-label="Delivery address" onSubmit={handleSubmit}>
      {showLabel && <label className="full">Label<input name="label" defaultValue="Home" /></label>}
      {FIELDS.map(({ name, label, full, optional, ...input }) => (
        <label key={name} className={full ? 'full' : undefined}>
          {label}
          <input name={name} defaultValue={initial?.[name] ?? ''} required={!optional} {...input} />
        </label>
      ))}
      <div className="form-actions full">
        <button className="primary" disabled={busy}>{busy ? 'Please wait…' : button}</button>
      </div>
    </form>
  );
}
