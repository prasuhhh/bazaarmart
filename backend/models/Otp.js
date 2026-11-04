import mongoose from 'mongoose';

const OTP_LIFETIME_MS = 5 * 60 * 1000;

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // one active code per phone
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + OTP_LIFETIME_MS) },
  attempts: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

// MongoDB deletes each code once expiresAt passes. Its cleanup runs about once a
// minute, so sign-in code must also check expiresAt itself.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);
