export class ApiError extends Error {
  constructor(code, message, fields = {}, extra = {}) {
    super(message || code || 'Request failed');
    this.name = 'ApiError';
    this.code = code || 'SERVER_ERROR';
    this.fields = fields || {};
    this.extra = extra || {};
  }
}

export function isApiError(error) {
  return error instanceof ApiError || (error && typeof error.code === 'string' && typeof error.message === 'string');
}
