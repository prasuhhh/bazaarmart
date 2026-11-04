const DUPLICATE_MESSAGES = {
  emailId: 'Email ID is already registered.',
  productId: 'Product ID already exists.'
};

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express identifies error middleware by its four arguments.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({ success: false, message: DUPLICATE_MESSAGES[field] || 'That record already exists.' });
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(e => e.message).join(' ');
    return res.status(400).json({ success: false, message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for ${err.path}.` });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(status).json({ success: false, message: 'Internal server error.' });
  }
  return res.status(status).json({ success: false, message: err.message });
}
