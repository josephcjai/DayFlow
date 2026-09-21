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
      
      // Finding 15 & 24: Invalidate sessions when token_version has been bumped (password changed/reset)
      // Fail-closed: Never accept tokens if DB errors out or if userId is malformed
      if (typeof decoded.userId !== 'string' || !decoded.userId) {
        return res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
      }

      let currentTokenVersion: number | null = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.userId);

      if (!isUuid) {
        // Malformed userId that is not a UUID (prevents raw Postgres 500 syntax errors)
        const memUser = memoryStore.users.find(u => u.id === decoded.userId);
        if (memUser) {
          currentTokenVersion = memUser.token_version ?? 1;
        } else {
          return res.status(401).json({ error: 'Unauthorized access. Invalid user identifier.' });
        }
      } else {
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
        } catch (dbErr: any) {
          const memUser = memoryStore.users.find(u => u.id === decoded.userId);
          if (memUser) {
            currentTokenVersion = memUser.token_version ?? 1;
          } else {
            // Fail closed! If DB lookup fails, return 503 instead of falling open
            console.error('❌ [authMiddleware] Database error during session version check:', dbErr.message);
            return res.status(503).json({ error: 'Database service is temporarily unavailable. Please try again later.' });
          }
        }
      }

      if (currentTokenVersion === null) {
        return res.status(401).json({ error: 'Unauthorized access. User session could not be verified.' });
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

