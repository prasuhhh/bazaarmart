const isSameDay = (a, b) => a.toDateString() === b.toDateString();
const timeOf = date => date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
const dayOf = date => date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// "4:30 pm" today, otherwise "Sat, 7 Nov".
export const shortMoment = value => {
  const date = new Date(value);
  return isSameDay(date, new Date()) ? timeOf(date) : dayOf(date);
};

export function windowText({ from, to }) {
  const start = new Date(from);
  const end = new Date(to);
  if (isSameDay(start, end)) return `Between ${timeOf(start)} and ${timeOf(end)}`;
  return `Between ${dayOf(start)} and ${dayOf(end)}`;
}

// "1 Nov 10:12", or "today 11:20".
export function journeyMoment(value) {
  const date = new Date(value);
  const clock = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isSameDay(date, new Date())) return `today ${clock}`;
  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${clock}`;
}
