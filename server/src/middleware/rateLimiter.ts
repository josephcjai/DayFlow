/**
 * Lightweight Auth Rate Limiter Middleware
 * Protects login and registration endpoints against brute-force attacks
 */
import { Request, Response, NextFunction } from 'express';

const attempts: Record<string, { count: number; resetTime: number }> = {};
let lastPrune = Date.now();

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = isDev && (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost');
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
  const MAX_ATTEMPTS = isLocalhost ? 500 : 50; // 50 attempts per client IP per 15 min; 500 on local dev

  // Prune expired IP records every 5 minutes to prevent memory leaks
  if (now - lastPrune > 5 * 60 * 1000) {
    lastPrune = now;
    for (const key of Object.keys(attempts)) {
      if (now > attempts[key].resetTime) {
        delete attempts[key];
      }
    }
  }

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
