export default function Stepper({ name, qty, max, onChange }) {
  return (
    <span className="stepper">
      <button type="button" aria-label={`Reduce ${name} quantity`} disabled={qty <= 1} onClick={() => onChange(qty - 1)}>−</button>
      <span>{qty}</span>
      <button type="button" aria-label={`Increase ${name} quantity`} disabled={qty >= max} onClick={() => onChange(qty + 1)}>+</button>
    </span>
  );
}
