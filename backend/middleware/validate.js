const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = value => typeof value === 'string' && EMAIL_PATTERN.test(value.trim());

export const isValidUsername = value => typeof value === 'string' && value.trim().length >= 2;

export const isValidPassword = value => typeof value === 'string' && value.length >= 6;

export function isValidAge(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return false;
  const age = Number(value);
  return Number.isFinite(age) && age >= 1 && age <= 120;
}
