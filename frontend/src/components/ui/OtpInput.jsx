import { useEffect, useRef } from 'react';

// `digits` is an array with one entry per box, so a gap stays in its own box.
export default function OtpInput({ digits, onChange, disabled }) {
  const boxes = useRef([]);
  const focusBox = index => boxes.current[index]?.focus();

  useEffect(() => {
    if (!disabled) focusBox(0);
  }, [disabled]);

  function handleChange(index, event) {
    const typed = event.target.value.replace(/\D/g, '');
    const next = [...digits];
    if (!typed) {
      next[index] = '';
      onChange(next);
      return;
    }
    // A pasted code spreads out across the boxes from here.
    const entered = typed.slice(0, digits.length - index).split('');
    entered.forEach((digit, offset) => { next[index + offset] = digit; });
    onChange(next);
    focusBox(Math.min(index + entered.length, digits.length - 1));
  }

  function handleKeyDown(index, event) {
    if (event.key === 'ArrowLeft') focusBox(index - 1);
    if (event.key === 'ArrowRight') focusBox(index + 1);
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next);
      focusBox(index - 1);
    }
  }

  return (
    <div className="otp-boxes">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={element => { boxes.current[index] = element; }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${digits.length}`}
          onChange={event => handleChange(index, event)}
          onKeyDown={event => handleKeyDown(index, event)}
          onFocus={event => event.target.select()}
        />
      ))}
    </div>
  );
}
