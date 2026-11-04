import { normalizePhone } from '../middleware/validate.js';
import { ApiError } from './response.js';

export const ADDRESS_FIELDS = ['label', 'name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];
export const REQUIRED_DELIVERY_FIELDS = ['name', 'phone', 'line1', 'city', 'state', 'pincode'];

export const pick = (body, fields) =>
  Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));

export function requireAddressFields(address, required) {
  const missing = required.filter(field => !address[field]);
  if (missing.length) throw new ApiError(400, `Address needs: ${missing.join(', ')}.`);
  address.phone = normalizePhone(address.phone);
  if (!address.phone) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number.');
}
