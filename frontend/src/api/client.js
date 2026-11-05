const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ASSET_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');
export const TOKEN_KEY = 'shopping_token';

// /products/... files belong to this site and full URLs stand alone. Any other relative path is on the API host.
export function assetUrl(path) {
  if (!path || path.startsWith('/products/') || /^https?:\/\//.test(path)) return path;
  return `${ASSET_ORIGIN}/${path.replace(/^\//, '')}`;
}

let handleUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  handleUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Returns the API envelope { success, message?, data?, count?, pagination? } or throws ApiError.
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please try again.');
  }

  if (response.status === 204) return { success: true };

  const envelope = await response.json().catch(() => null);
  if (response.ok && envelope) return envelope;

  // A wrong password is also a 401, but no token is sent with that request.
  if (response.status === 401 && token) handleUnauthorized();
  throw new ApiError(response.status, envelope?.message || 'Something went wrong. Please try again.');
}
