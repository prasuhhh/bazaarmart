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

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Usage: throw fail(404, 'User not found.');
export const fail = (status, message) => new HttpError(status, message);
