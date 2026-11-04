import { ApiError, fail } from '../utils/response.js';

const DUPLICATE_MESSAGES = {
  emailId: 'Email ID is already registered.',
  productId: 'Product ID already exists.',
  product: 'You have already reviewed this product.'
};
const JWT_ERRORS = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);

export function notFound(req, res) {
  fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

// Express identifies error middleware by its four arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) return fail(res, err.status, err.message);

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return fail(res, 409, DUPLICATE_MESSAGES[field] || 'That record already exists.');
  }
  if (err.name === 'ValidationError') {
    return fail(res, 400, Object.values(err.errors).map(e => e.message).join(' '));
  }
  if (err.name === 'CastError') return fail(res, 400, `Invalid value for ${err.path}.`);
  if (JWT_ERRORS.has(err.name)) return fail(res, 401, 'Invalid or expired token.');
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Request body is not valid JSON.');

  // Errors Express raises itself, such as a malformed URL or an oversized body.
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) return fail(res, status, err.message);

  console.error(err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message;
  return fail(res, 500, message);
}
