/**
 * Habit Ledger Routes
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';

const router = Router();

// GET Habits for Week
router.get('/week/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const resPg = await executeQuery(
      'SELECT id, habit_name as name, pts, log_time as time, notes FROM habit_logs WHERE week_start = $1 ORDER BY created_at ASC',
      [weekStart]
    );

    let habits = resPg.rows;
    if (habits.length === 0 && memoryStore.scheduleWeeks[weekStart]) {
      habits = memoryStore.scheduleWeeks[weekStart].habits || [];
    }

    res.json({ weekStart, habits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Log Habit Entry
router.post('/log', async (req, res) => {
  try {
    const { weekStart, name, pts, notes } = req.body;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLog = {
      id: Date.now(),
      name,
      pts: pts || 5,
      time: timeStr,
      notes: notes || ''
    };

    if (!memoryStore.scheduleWeeks[weekStart]) {
      memoryStore.scheduleWeeks[weekStart] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[weekStart].habits.push(newLog);

    executeQuery(
      'INSERT INTO habit_logs (week_start, habit_name, pts, log_time, notes) VALUES ($1, $2, $3, $4, $5)',
      [weekStart, name, newLog.pts, timeStr, notes || '']
    );

    res.json({ message: 'Habit logged successfully', habit: newLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Habit Log
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const logId = parseInt(id, 10);

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      memoryStore.scheduleWeeks[wKey].habits = (memoryStore.scheduleWeeks[wKey].habits || []).filter((h: any) => h.id !== logId);
    });

    executeQuery('DELETE FROM habit_logs WHERE id = $1', [id]);

    res.json({ message: 'Habit log removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
