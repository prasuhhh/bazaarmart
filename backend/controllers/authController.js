import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { normalizePhone } from '../middleware/validate.js';
import Otp, { OTP_LIFETIME_MS } from '../models/Otp.js';
import User from '../models/User.js';
import { ApiError, ok } from '../utils/response.js';
import { createSession } from '../utils/session.js';
import { isSmsConfigured, isSmsMock, sendSms } from '../utils/sms.js';

const MAX_ATTEMPTS = 5;
const OTP_HASH_COST = 10;

const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

function requirePhone(value) {
  const phone = normalizePhone(value);
  if (!phone) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number.');
  return phone;
}

export async function requestOtp(req, res) {
  const phone = requirePhone(req.body.phone);
  if (!isSmsConfigured()) throw new ApiError(503, 'SMS sign-in is not configured.');

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, OTP_HASH_COST);
  // Sent before saving, so a failed send leaves any earlier code usable.
  const minutes = OTP_LIFETIME_MS / 60_000;
  await sendSms(phone, `Your BazaarMart sign-in code is ${code}. It expires in ${minutes} minutes. Do not share it.`);
  await Otp.findOneAndUpdate(
    { phone },
    { codeHash, attempts: 0, expiresAt: new Date(Date.now() + OTP_LIFETIME_MS) },
    { upsert: true }
  );

  const showCode = isSmsMock() && process.env.NODE_ENV !== 'production';
  ok(res, { message: 'OTP sent.', data: showCode ? { devCode: code } : undefined });
}

export async function verifyOtp(req, res) {
  const phone = requirePhone(req.body.phone);
  const { code } = req.body;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code.');

  // Counting the attempt first means parallel guesses can't get past the limit.
  const otp = await Otp.findOneAndUpdate({ phone }, { $inc: { attempts: 1 } }, { new: true });
  if (!otp || otp.expiresAt <= new Date()) {
    if (otp) await otp.deleteOne();
    throw new ApiError(400, 'This code has expired. Please request a new one.');
  }

  const isMatch = otp.attempts <= MAX_ATTEMPTS && await bcrypt.compare(code, otp.codeHash);
  if (!isMatch) {
    const remaining = MAX_ATTEMPTS - otp.attempts;
    if (remaining > 0) throw new ApiError(401, `Wrong code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`);
    await otp.deleteOne();
    throw new ApiError(429, 'Too many wrong attempts. Please request a new code.');
  }

  await otp.deleteOne();
  // An atomic upsert, so two quick verifies can't create two accounts.
  const user = await User.findOneAndUpdate({ phone }, { $setOnInsert: { role: 'user' } }, { new: true, upsert: true });
  ok(res, { message: 'Signed in.', data: createSession(user) });
}

export function googleSignIn() {
  throw new ApiError(501, 'Google sign-in is not configured');
}
