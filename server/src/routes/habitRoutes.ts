/**
 * Habit Ledger Routes
 * Secured with authMiddleware and strict per-user SQL isolation
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce authMiddleware on all habit routes
router.use(authMiddleware);

// GET Habits for Week
router.get('/week/:weekStart', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart } = req.params;

    let habits: any[] = [];
    try {
      const resPg = await executeQuery(
        'SELECT id, habit_name as name, pts, log_time as time, notes FROM habit_logs WHERE user_id = $1 AND week_start = $2 ORDER BY created_at ASC',
        [userId, weekStart]
      );
      habits = resPg.rows;
    } catch (e) {
      if (memoryStore.scheduleWeeks[`${userId}_${weekStart}`]) {
        habits = memoryStore.scheduleWeeks[`${userId}_${weekStart}`].habits || [];
      }
    }

    res.json({ weekStart, habits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Log Habit Entry
router.post('/log', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart, name, pts, notes, logTime } = req.body;
    const now = new Date();
    const timeStr = logTime || `${weekStart} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newLog = {
      id: Date.now(),
      name,
      pts: pts || 5,
      time: timeStr,
      notes: notes || ''
    };

    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[userWeekKey].habits.push(newLog);

    try {
      const insertRes = await executeQuery(
        'INSERT INTO habit_logs (user_id, week_start, habit_name, pts, log_time, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, weekStart, name, newLog.pts, timeStr, notes || '']
      );
      if (insertRes.rows[0]) {
        newLog.id = insertRes.rows[0].id;
      }
    } catch (e) {
      console.warn('PostgreSQL habit insert fallback to memory store');
    }

    res.json({ message: 'Habit logged successfully', habit: newLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Habit Log
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const logId = parseInt(id, 10);

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      if (wKey.startsWith(`${userId}_`)) {
        memoryStore.scheduleWeeks[wKey].habits = (memoryStore.scheduleWeeks[wKey].habits || []).filter((h: any) => h.id !== logId);
      }
    });

    try {
      await executeQuery('DELETE FROM habit_logs WHERE id = $1 AND user_id = $2', [id, userId]);
    } catch (e) {
      console.warn('PostgreSQL habit delete fallback');
    }

    res.json({ message: 'Habit log removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
