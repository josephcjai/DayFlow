/**
 * DayFlow Express Server Entry Point
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
dotenv.config();
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import todoRoutes from './routes/todoRoutes.js';
import { authRateLimiter } from './middleware/rateLimiter.js';
import { openApiDocument } from './swagger.js';
import { pool } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Finding 14: Require APP_URL in production (fail fast)
if (isProd && !process.env.APP_URL) {
  throw new Error('FATAL: APP_URL environment variable must be set in production!');
}

// Parse allowed origins; default to strict check in production, reflect origin in dev
const ALLOWED_ORIGINS: any = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : (isProd ? [] : true);

// Trust reverse proxy (e.g. Nginx, Cloudflare, container gateway) for correct client IP & protocol
app.set('trust proxy', 1);

// HTTP Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false, // Required for Google Identity Services
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false
}));

// CORS Configuration
app.use(cors({
  origin: ALLOWED_ORIGINS.length === 0 && isProd ? false : ALLOWED_ORIGINS,
  credentials: true
}));

// Request Body Parser with payload limit
app.use(express.json({ limit: '200kb' }));

// Interactive Swagger UI API Documentation at /docs and /api-docs
app.use(['/docs', '/api-docs'], swaggerUi.serve, swaggerUi.setup(openApiDocument));

// API Base Info Endpoint
app.get(['/', '/api'], (req, res) => {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;

  res.json({
    name: 'DayFlow REST API Server',
    version: '2.4.0',
    status: 'online',
    interactiveDocs: `${baseUrl}/docs`,
    healthCheck: `${baseUrl}/api/health`,
    endpoints: {
      auth: '/api/auth (POST /register, POST /login, POST /google, GET /me)',
      schedule: '/api/schedule (GET /week/:weekStart, POST /slot, DELETE /slot)',
      habits: '/api/habits (GET /week/:weekStart, POST /log, DELETE /:id)',
      todos: '/api/todos (GET /week/:weekStart, POST /todo, PATCH /:id, DELETE /:id, POST /notes)',
      health: '/api/health'
    }
  });
});

// API Routes
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/todos', todoRoutes);

// Health & Database Readiness Check Endpoint
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'online',
      database: 'connected',
      service: 'DayFlow API Server',
      version: '2.4.0',
      timestamp: new Date()
    });
  } catch (err: any) {
    console.error('Database Health Check Failed:', err.message);
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: isProd ? 'Database connection unavailable' : err.message,
      timestamp: new Date()
    });
  }
});

// Fallback 404 for unhandled API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : (err.message || 'Unknown server error')
  });
});

// Start Express Listener
const server = app.listen(PORT, () => {
  console.log(`🚀 DayFlow Express REST API running on http://localhost:${PORT}`);
  console.log(`📚 Interactive Swagger API Documentation available at http://localhost:${PORT}/docs`);
});

// Graceful Shutdown on SIGTERM / SIGINT
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    console.log('🔒 Closed incoming HTTP connections.');
    try {
      await pool.end();
      console.log('💾 PostgreSQL connection pool drained.');
      process.exit(0);
    } catch (dbErr: any) {
      console.error('Error draining PostgreSQL pool:', dbErr.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('⚠️ Forceful shutdown timeout exceeded. Exiting.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

