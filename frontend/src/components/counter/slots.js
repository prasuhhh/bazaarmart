const TODAY_CUTOFF_HOUR = 18;
const DELIVERY_HOUR = 19;
const LAST_BOOKABLE_DAY = 14;

const atDeliveryHour = daysAhead => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(DELIVERY_HOUR, 30, 0, 0);
  return date;
};

const dayValue = date => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// Today's window is hidden once it has started.
export function quickSlots(now = new Date()) {
  const slots = [{ label: 'Tomorrow', date: atDeliveryHour(1).toISOString() }];
  if (now.getHours() < TODAY_CUTOFF_HOUR) slots.unshift({ label: 'Today 6–9 pm', date: atDeliveryHour(0).toISOString() });
  return slots;
}

export const dayRange = () => ({ min: dayValue(atDeliveryHour(1)), max: dayValue(atDeliveryHour(LAST_BOOKABLE_DAY)) });

export function slotForDay(value) {
  const date = new Date(`${value}T19:30`);
  const label = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return { label, date: date.toISOString() };
}
