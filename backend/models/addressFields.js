// Shared by a user's saved addresses and the delivery address on an order.
export const addressFields = {
  label: { type: String, trim: true },
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  line1: { type: String, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits.'] }
};
