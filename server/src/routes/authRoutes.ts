/**
 * Authentication Routes (Register, Login, & User Profile)
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dayflow_local_secret_key_2026';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
}

// Get Public Auth Configuration (e.g. Google Client ID)
router.get('/config', (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

// Google One-Tap / Identity Services Login & Registration
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in the server environment (.env)' });
    }

    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Unable to verify Google user payload' });
    }

    const googleId = payload.sub;
    const cleanEmail = payload.email.trim().toLowerCase();
    const displayName = payload.name || payload.email.split('@')[0] || 'DayFlow User';
    const avatarUrl = payload.picture || null;

    // Check existing user by google_id or email
    const userResult = await executeQuery('SELECT * FROM users WHERE google_id = $1 OR LOWER(email) = $2', [googleId, cleanEmail]);
    let user = userResult.rows[0];

    if (user) {
      // If user existed, link google_id or avatar if missing
      if (!user.google_id || !user.avatar_url) {
        await executeQuery(
          'UPDATE users SET google_id = COALESCE(google_id, $1), avatar_url = COALESCE(avatar_url, $2), display_name = COALESCE(display_name, $3) WHERE id = $4',
          [googleId, avatarUrl, displayName, user.id]
        );
      }
    } else {
      // Create new user without password_hash
      const insertResult = await executeQuery(
        'INSERT INTO users (email, display_name, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, avatar_url',
        [cleanEmail, displayName, googleId, avatarUrl]
      );
      user = insertResult.rows[0];

      if (!user) {
        user = { id: `usr_${Date.now()}`, email: cleanEmail, displayName, googleId, avatarUrl };
        memoryStore.users.push(user);
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.displayName,
        avatarUrl: user.avatar_url || user.avatarUrl || avatarUrl,
      },
    });
  } catch (err: any) {
    console.error('Google Auth Verification Error:', err);
    res.status(401).json({ error: 'Invalid Google credential: ' + (err.message || 'Verification failed') });
  }
});

// Register New User
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Check existing user in PostgreSQL
    const existing = await executeQuery('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const result = await executeQuery(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [cleanEmail, passwordHash, displayName || 'DayFlow User']
    );

    let user = result.rows[0];
    if (!user) {
      user = { id: `usr_${Date.now()}`, email: cleanEmail, displayName: displayName || 'DayFlow User' };
      memoryStore.users.push({ ...user, passwordHash });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'Registration successful', token, user: { id: user.id, email: user.email, displayName: user.display_name || user.displayName } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const result = await executeQuery('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    let user = result.rows[0];

    if (!user) {
      const memUser = memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
      if (memUser) {
        user = memUser;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash || user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name || user.displayName } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const result = await executeQuery('SELECT id, email, display_name, avatar_url FROM users WHERE id = $1', [userId]);
    const user = result.rows[0] || memoryStore.users.find(u => u.id === userId);

    if (user) {
      res.json({ user: { id: user.id, email: user.email, displayName: user.display_name || user.displayName, avatarUrl: user.avatar_url || user.avatarUrl || null } });
    } else {
      res.status(404).json({ error: 'User profile not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
