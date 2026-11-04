import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from '../utils/response.js';

// The user is loaded on every request, so a deleted account loses access at once
// and the role always comes from the database rather than from an old token.
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required.');

  const { userId } = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'Invalid or expired token.');

  req.user = { userId: user._id, emailId: user.emailId, role: user.role };
  next();
}

export function authorizeEmail(req, _res, next) {
  const emailId = String(req.query.emailId || '').toLowerCase().trim();
  if (!emailId) throw new ApiError(400, 'emailId query parameter is required.');
  if (emailId !== req.user.emailId) throw new ApiError(403, 'You can only manage your own profile.');
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin access required.');
  next();
}
