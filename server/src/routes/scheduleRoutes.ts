/**
 * 30-Minute Schedule Slot Routes (Strict User Isolation)
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authMiddleware);

// GET Week Schedule Slots for authenticated user ONLY
router.get('/week/:weekStart', async (req: AuthenticatedRequest, res) => {
  try {
    const { weekStart } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    // Query PostgreSQL filtered strictly by user_id
    const resPg = await executeQuery(
      `SELECT s.slot_key, s.planned_task, s.actual_task, s.category, s.planned_duration, s.actual_duration, s.status, s.notes 
       FROM schedule_slots s
       JOIN schedule_weeks w ON s.week_id = w.id
       WHERE w.start_date = $1::date AND w.user_id = $2`,
      [weekStart, userId]
    );

    const slots: Record<string, any> = {};
    if (resPg.rows.length > 0) {
      resPg.rows.forEach(r => {
        slots[r.slot_key] = {
          plannedTask: r.planned_task,
          actualTask: r.actual_task,
          category: r.category,
          planned: r.planned_duration,
          actual: r.actual_duration,
          status: r.status,
          notes: r.notes
        };
      });
    } else {
      // Memory Store fallback
      const userWeekKey = `${userId}_${weekStart}`;
      const memWeek = memoryStore.scheduleWeeks[userWeekKey];
      if (memWeek) {
        Object.assign(slots, memWeek.slots || {});
      }
    }

    res.json({ weekStart, slots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save or Update a 30-Minute Slot Task for authenticated user ONLY
router.post('/slot', async (req: AuthenticatedRequest, res) => {
  try {
    const { weekStart, slotKey, plannedTask, actualTask, category, planned, actual, status, notes } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    if (!weekStart || !slotKey) {
      return res.status(400).json({ error: 'weekStart and slotKey are required' });
    }

    const slotObj = {
      plannedTask: plannedTask || '',
      actualTask: actualTask || plannedTask || '',
      category: category || 'General',
      planned: isNaN(parseInt(planned, 10)) ? 30 : parseInt(planned, 10),
      actual: actual !== undefined && !isNaN(parseInt(actual, 10)) ? parseInt(actual, 10) : 0,
      status: status || 'Pending',
      notes: notes || ''
    };

    // 1. Ensure schedule_weeks row exists specifically for THIS user_id and weekStart
    let weekId: string | null = null;
    const weekRes = await executeQuery(
      `INSERT INTO schedule_weeks (user_id, start_date) 
       VALUES ($1, $2::date) 
       ON CONFLICT (user_id, start_date) DO UPDATE SET start_date = EXCLUDED.start_date
       RETURNING id`,
      [userId, weekStart]
    );

    weekId = weekRes.rows[0]?.id;
    if (!weekId) {
      const getRes = await executeQuery(`SELECT id FROM schedule_weeks WHERE start_date = $1::date AND user_id = $2`, [weekStart, userId]);
      weekId = getRes.rows[0]?.id;
    }

    // 2. Insert or Update schedule_slots row
    if (weekId) {
      await executeQuery(
        `INSERT INTO schedule_slots (week_id, slot_key, planned_task, actual_task, category, planned_duration, actual_duration, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (week_id, slot_key) DO UPDATE 
         SET planned_task = EXCLUDED.planned_task,
             actual_task = EXCLUDED.actual_task,
             category = EXCLUDED.category,
             planned_duration = EXCLUDED.planned_duration,
             actual_duration = EXCLUDED.actual_duration,
             status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             updated_at = CURRENT_TIMESTAMP`,
        [weekId, slotKey, slotObj.plannedTask, slotObj.actualTask, slotObj.category, slotObj.planned, slotObj.actual, slotObj.status, slotObj.notes]
      );
    }

    // Memory Store Cache
    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[userWeekKey].slots[slotKey] = slotObj;

    res.json({ message: 'Slot saved successfully', slotKey, slot: slotObj });
  } catch (err: any) {
    console.error('Error saving slot to PG:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a 30-Minute Slot Task for authenticated user ONLY
router.delete('/slot', async (req: AuthenticatedRequest, res) => {
  try {
    const { weekStart, slotKey } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    const userWeekKey = `${userId}_${weekStart}`;
    if (memoryStore.scheduleWeeks[userWeekKey] && memoryStore.scheduleWeeks[userWeekKey].slots) {
      delete memoryStore.scheduleWeeks[userWeekKey].slots[slotKey];
    }

    await executeQuery(
      `DELETE FROM schedule_slots WHERE slot_key = $1 AND week_id IN (SELECT id FROM schedule_weeks WHERE start_date = $2::date AND user_id = $3)`,
      [slotKey, weekStart, userId]
    );

    res.json({ message: 'Slot cleared successfully', slotKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
