import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { addressFields } from './addressFields.js';

const BCRYPT_COST = 10;

const addressSchema = new mongoose.Schema({
  ...addressFields,
  isDefault: { type: Boolean, default: false }
});

// Display details only. Full card numbers are never stored.
const paymentMethodSchema = new mongoose.Schema({
  type: { type: String, enum: ['upi', 'card'], required: true },
  label: { type: String, required: true, trim: true },
  last4: { type: String, match: [/^\d{4}$/, 'last4 must be exactly 4 digits.'] }
});

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true },
  purchasedAt: Date,
  warrantyUntil: Date
});

const userSchema = new mongoose.Schema({
  // Sparse, because a phone-only account has no email and a plain unique index
  // would treat every missing value as the same duplicate.
  emailId: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^\+91[6-9]\d{9}$/, 'Phone must look like +919876543210.']
  },
  username: { type: String, trim: true, minlength: 2 },
  age: { type: Number, min: 1, max: 120 },
  password: { type: String, minlength: 6, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  addresses: [addressSchema],
  paymentMethods: [paymentMethodSchema],
  devices: [deviceSchema],
  stylePrefs: {
    sizes: [String],
    colours: [String],
    brands: [String]
  },
  notificationPrefs: {
    orderUpdates: { type: Boolean, default: true },
    priceDrops: { type: Boolean, default: true },
    newDrops: { type: Boolean, default: true }
  }
}, {
  timestamps: true,
  toJSON: {
    transform(_doc, json) {
      delete json.password;
      delete json.__v;
      return json;
    }
  }
});

userSchema.pre('validate', function requireContactDetail() {
  if (!this.emailId && !this.phone) this.invalidate('emailId', 'An email or phone number is required.');
});

// Runs only through save(). Updates must load the document and save it, because
// findOneAndUpdate skips this hook and would store a plain password.
userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

// Load the user with .select('+password') first. OTP accounts have no password.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return this.password ? bcrypt.compare(candidate, this.password) : Promise.resolve(false);
};

export default mongoose.model('User', userSchema);
