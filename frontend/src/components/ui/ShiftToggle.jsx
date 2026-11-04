import { useTheme } from '../../context/ThemeContext.jsx';

export default function ShiftToggle() {
  const { theme, toggleTheme } = useTheme();
  const isNight = theme === 'night';
  return (
    <button type="button" className="shift-toggle" role="switch" aria-checked={isNight} aria-label="Night shift" onClick={toggleTheme}>
      {isNight ? 'Night shift' : 'Day shift'}
      <span className="shift-track" aria-hidden="true"><span className="shift-knob" /></span>
    </button>
  );
}
