/**
 * Authentication Routes (Register, Login, & User Profile)
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendError } from '../utils/errorHandler.js';
import { EmailService } from '../utils/emailService.js';

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
    sendError(res, 500, err);
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

    const passwordHash = user.password_hash || user.passwordHash;
    if (!passwordHash) {
      return res.status(401).json({ error: 'This account was created with Google Sign-In. Please continue with Google.' });
    }

    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name || user.displayName } });
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const result = await executeQuery('SELECT id, email, display_name, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1', [userId]);
    const user = result.rows[0] || memoryStore.users.find(u => u.id === userId);

    if (user) {
      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name || user.displayName,
          avatarUrl: user.avatar_url || user.avatarUrl || null,
          hasPassword: user.has_password !== undefined ? !!user.has_password : !!(user.password_hash || user.passwordHash)
        }
      });
    } else {
      res.status(404).json({ error: 'User profile not found' });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// Change Password (from Settings - Authenticated)
router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const result = await executeQuery('SELECT * FROM users WHERE id = $1', [userId]);
    let user = result.rows[0] || memoryStore.users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const existingHash = user.password_hash || user.passwordHash;
    if (existingHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, existingHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await executeQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

    if (user.passwordHash !== undefined) {
      user.passwordHash = newHash;
    }
    user.password_hash = newHash;

    // Send security notification asynchronously
    EmailService.sendPasswordChangedNotice(user.email, user.display_name || user.displayName).catch(err => {
      console.warn('Could not dispatch password change notice:', err);
    });

    res.json({ message: 'Password updated successfully' });
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// Forgot Password (Public - Generates reset token & sends Brevo email)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const genericSuccess = {
      message: 'If an account exists for this email address, a password reset link has been dispatched. Please check your inbox.'
    };

    const userResult = await executeQuery('SELECT id, email, display_name FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    let user = userResult.rows[0];

    if (!user) {
      const memUser = memoryStore.users.find(u => u.email.toLowerCase() === cleanEmail);
      if (memUser) user = memUser;
    }

    if (!user) {
      // Return generic message to prevent email enumeration
      return res.json(genericSuccess);
    }

    // Generate secure 32-byte hex token and store its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Invalidate any previous unused tokens for this user
    await executeQuery('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);

    // Insert new reset token
    await executeQuery(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    if (memoryStore.passwordResetTokens) {
      memoryStore.passwordResetTokens.push({
        userId: user.id,
        email: cleanEmail,
        tokenHash,
        expiresAt,
        used: false
      });
    }

    // Send email via Brevo REST API
    const reqOrigin = (req.headers.origin as string) || (req.headers.referer as string);
    await EmailService.sendPasswordResetEmail(cleanEmail, user.display_name || user.displayName || 'User', rawToken, reqOrigin);

    res.json(genericSuccess);
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// Reset Password (Public - Verifies token & updates password)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, reset token, and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const result = await executeQuery(`
      SELECT prt.id as token_id, prt.expires_at, prt.used, u.id as user_id, u.email, u.display_name
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE LOWER(u.email) = $1 AND prt.token_hash = $2
      ORDER BY prt.created_at DESC
      LIMIT 1
    `, [cleanEmail, tokenHash]);

    let record = result.rows[0];

    if (!record && memoryStore.passwordResetTokens) {
      const memToken = memoryStore.passwordResetTokens.find(
        t => t.email.toLowerCase() === cleanEmail && t.tokenHash === tokenHash
      );
      if (memToken) {
        const memUser = memoryStore.users.find(u => u.id === memToken.userId);
        if (memUser) {
          record = {
            token_id: 'mem_tok',
            expires_at: memToken.expiresAt,
            used: memToken.used,
            user_id: memUser.id,
            email: memUser.email,
            display_name: memUser.displayName
          };
        }
      }
    }

    if (!record || record.used) {
      return res.status(400).json({ error: 'This password reset link is invalid or has already been used. Please request a new one.' });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This password reset link has expired. Password reset links are valid for 1 hour.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user password and mark token as used
    await executeQuery('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, record.user_id]);
    await executeQuery('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.token_id]);

    const memUser = memoryStore.users.find(u => u.id === record.user_id);
    if (memUser) {
      memUser.passwordHash = passwordHash;
      memUser.password_hash = passwordHash;
    }

    // Send security notification
    EmailService.sendPasswordChangedNotice(cleanEmail, record.display_name || 'User').catch(err => {
      console.warn('Could not dispatch password change notice after reset:', err);
    });

    res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

export default router;
