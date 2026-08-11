/**
 * DayFlow Express Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './routes/authRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import todoRoutes from './routes/todoRoutes.js';
import { authRateLimiter } from './middleware/rateLimiter.js';
import { openApiDocument } from './swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : '*';

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Interactive Swagger UI API Documentation at /docs and /api-docs
app.use(['/docs', '/api-docs'], swaggerUi.serve, swaggerUi.setup(openApiDocument));

// API Base Info Endpoint
app.get(['/', '/api'], (req, res) => {
  res.json({
    name: 'DayFlow REST API Server',
    version: '2.3.0',
    status: 'online',
    interactiveDocs: `http://localhost:${PORT}/docs`,
    healthCheck: `http://localhost:${PORT}/api/health`,
    endpoints: {
      auth: '/api/auth (POST /register, POST /login, GET /me)',
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

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', service: 'DayFlow API Server', timestamp: new Date() });
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`🚀 DayFlow Express REST API running on http://localhost:${PORT}`);
  console.log(`📚 Interactive Swagger API Documentation available at http://localhost:${PORT}/docs`);
});
