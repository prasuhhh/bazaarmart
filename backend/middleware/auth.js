import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ApiError } from '../utils/response.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// The user is loaded on every request, so a deleted account loses access at once
// and the role always comes from the database rather than from an old token.
async function loadUser(token) {
  const { userId } = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(userId);
  return user && { userId: user._id, emailId: user.emailId, phone: user.phone, role: user.role };
}

export async function authenticate(req, _res, next) {
  const token = bearerToken(req);
  if (!token) throw new ApiError(401, 'Authentication required.');

  req.user = await loadUser(token);
  if (!req.user) throw new ApiError(401, 'Invalid or expired token.');
  next();
}

// For routes open to guests: a usable token identifies the user, anything else
// simply leaves the request as a guest.
export async function optionalAuth(req, _res, next) {
  try {
    const token = bearerToken(req);
    if (token) req.user = (await loadUser(token)) ?? undefined;
  } catch {
    req.user = undefined;
  }
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
