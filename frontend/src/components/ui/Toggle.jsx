export default function Toggle({ label, checked, disabled, onChange }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="shift-track" aria-hidden="true"><span className="shift-knob" /></span>
    </button>
  );
}
