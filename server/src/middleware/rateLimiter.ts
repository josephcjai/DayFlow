/**
 * Lightweight Auth Rate Limiter Middleware
 * Protects login and registration endpoints against brute-force attacks
 */
import { Request, Response, NextFunction } from 'express';

const attempts: Record<string, { count: number; resetTime: number }> = {};

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown_ip';
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
  const MAX_ATTEMPTS = 15; // Max 15 login/register attempts per IP per 15m

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
