const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts 9876543210 or +91 98765 43210 and returns +919876543210, or null if invalid.
// A + is optional because an unencoded + in a URL query arrives as a space.
export function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[\s-]/g, '');
  const match = /^(?:\+?91)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

export const isValidEmail = value => typeof value === 'string' && EMAIL_PATTERN.test(value.trim());

export const isValidUsername = value => typeof value === 'string' && value.trim().length >= 2;

export const isValidPassword = value => typeof value === 'string' && value.length >= 6;

export function isValidAge(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return false;
  const age = Number(value);
  return Number.isFinite(age) && age >= 1 && age <= 120;
}
