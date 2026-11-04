export const PAYMENT_METHODS = [['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking'], ['cod', 'COD']];
export const paymentLabel = method => PAYMENT_METHODS.find(([value]) => value === method)?.[1];

export default function PayStep({ chosen, onChoose }) {
  return (
    <>
      <div className="choice-row">
        {PAYMENT_METHODS.map(([value, label]) => (
          <button type="button" key={value} className={`pill${value === chosen ? ' on' : ''}`} aria-pressed={value === chosen} onClick={() => onChoose(value)}>{label}</button>
        ))}
      </div>
      <p className="field-help">Payment is simulated. No real money moves, and no card or bank details are asked for.</p>
    </>
  );
}
