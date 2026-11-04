import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useReceipt } from '../../context/ReceiptContext.jsx';
import ShiftToggle from '../ui/ShiftToggle.jsx';
import CommandBox from './CommandBox.jsx';
import { routeTitle } from './routeTitle.js';

function initialsOf(user) {
  const name = user?.username ?? user?.emailId ?? '';
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
}

export default function TopBar({ zones, isTaskbarOpen, onMenu }) {
  const { user } = useAuth();
  const { lineCount, openReceipt } = useReceipt();
  const { pathname } = useLocation();

  return (
    <header className="topbar">
      <button type="button" className="menu-button" aria-label="Open menu" aria-expanded={isTaskbarOpen} onClick={onMenu}>☰</button>
      <h1 className="topbar-title">{routeTitle(pathname, zones)}</h1>
      <CommandBox zones={zones} />
      <div className="topbar-right">
        <ShiftToggle />
        <button type="button" className="receipt-button" data-receipt-target onClick={openReceipt}>Receipt · {lineCount}</button>
        <Link className="avatar-button" to={user ? '/profile' : '/signin'} aria-label={user ? 'Your profile' : 'Sign in'}>
          {initialsOf(user)}
        </Link>
      </div>
    </header>
  );
}
