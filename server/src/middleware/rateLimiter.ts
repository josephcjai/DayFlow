/**
 * Lightweight Auth Rate Limiter Middleware
 * Protects login and registration endpoints against brute-force attacks
 */
import { Request, Response, NextFunction } from 'express';

const attempts: Record<string, { count: number; resetTime: number }> = {};

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
  const MAX_ATTEMPTS = isLocalhost ? 500 : 50; // Generous allowance for local development & testing

  if (!attempts[ip] || now > attempts[ip].resetTime) {
    attempts[ip] = { count: 1, resetTime: now + WINDOW_MS };
    return next();
  }

  attempts[ip].count += 1;

  if (attempts[ip].count > MAX_ATTEMPTS) {
    return res.status(429).json({
      error: 'Too many authentication attempts. Please try again after 15 minutes.'
    });
  }

  next();
}
