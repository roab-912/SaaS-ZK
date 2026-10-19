import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { validationMessage } from '../shared/validation.mjs';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
export const fail = (status, message) => new HttpError(status, message);
export function input(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ZodError || error instanceof HttpError) throw error;
    throw fail(400, error.message || 'Données invalides.');
  }
}
export function errorHandler(logger = console) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    const id = randomUUID();
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : error.type === 'entity.too.large'
            ? 413
            : error.type === 'entity.parse.failed'
              ? 400
              : 500;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof ZodError
          ? validationMessage(error)
          : status === 413
            ? 'Requête trop volumineuse.'
            : status === 400
              ? 'Requête JSON invalide.'
              : 'Erreur interne. Réessayez.';
    if (status >= 500)
      logger.error({ event: 'request_failed', requestId: id, errorType: error.name });
    res.status(status).set('X-Request-Id', id).json({ error: message });
  };
}
