/**
 * Standardized Error Handler Helper
 * Protects database schema & internal error details in production environments
 */
import { Response } from 'express';

const isProd = process.env.NODE_ENV === 'production';

export function sendError(res: Response, status: number, err: any, fallbackMessage = 'Internal server error') {
  if (err && err.message) {
    console.error(`[Error ${status}]:`, err.message);
  } else {
    console.error(`[Error ${status}]:`, err);
  }

  const errorMessage = isProd
    ? (status >= 500 ? fallbackMessage : (err?.message || fallbackMessage))
    : (err?.message || fallbackMessage);

  return res.status(status).json({ error: errorMessage });
}
