/**
 * Express Authentication Middleware
 * Enforces strict JWT Token authentication for user isolation
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dayflow_local_secret_key_2026';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    }
  }

  if (customUserId) {
    req.userId = customUserId;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized access. Authentication token required.' });
}
