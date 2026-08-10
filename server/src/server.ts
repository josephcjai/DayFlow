/**
 * DayFlow Express Server Entry Point
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import todoRoutes from './routes/todoRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
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
});
