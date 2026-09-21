import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { executeQuery, memoryStore } from '../db/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dayflow_local_secret_key_2026';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
}


export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  tokenVersion?: number;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; tokenVersion?: number };
      
      // Finding 15: Invalidate sessions when token_version has been bumped (password changed/reset)
      let currentTokenVersion = 1;
      try {
        const result = await executeQuery('SELECT token_version FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length > 0) {
          currentTokenVersion = result.rows[0].token_version ?? 1;
        } else {
          const memUser = memoryStore.users.find(u => u.id === decoded.userId);
          if (memUser) {
            currentTokenVersion = memUser.token_version ?? 1;
          } else {
            return res.status(401).json({ error: 'Unauthorized access. User no longer exists.' });
          }
        }
      } catch {
        const memUser = memoryStore.users.find(u => u.id === decoded.userId);
        if (memUser) {
          currentTokenVersion = memUser.token_version ?? 1;
        }
      }

      const decodedTokenVersion = decoded.tokenVersion ?? 1;
      if (decodedTokenVersion !== currentTokenVersion) {
        return res.status(401).json({ error: 'Session expired or invalidated. Please sign in again.' });
      }

      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.tokenVersion = decodedTokenVersion;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized access. Authentication token required.' });
}

