// One response envelope for the whole API: { success, message?, data?, count? }.
export function ok(res, body = {}) {
  return res.status(200).json({ success: true, ...body });
}

export function created(res, body = {}) {
  return res.status(201).json({ success: true, ...body });
}

export function noContent(res) {
  return res.status(204).end();
}

export function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// Throw this from anywhere in a request; errorHandler turns it into a response.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 5 already forwards rejected async handlers, so routes don't need this.
// It's here for code that runs handlers outside Express's own routing.
export const asyncHandler = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
