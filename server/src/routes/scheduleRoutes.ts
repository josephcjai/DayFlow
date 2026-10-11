/**
 * 30-Minute Schedule Slot Routes (Strict User Isolation)
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isValidDateRange } from '../utils/dateValidation.js';
import { sendError } from '../utils/errorHandler.js';

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

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }

    // Query PostgreSQL filtered strictly by user_id
    const resPg = await executeQuery(
      `SELECT s.slot_key, s.planned_task, s.actual_task, s.category, s.planned_duration, s.actual_duration, s.status, s.notes, s.is_productive 
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
          notes: r.notes,
          ...(r.is_productive !== null && r.is_productive !== undefined ? { isProductive: r.is_productive } : {})
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
    sendError(res, 500, err);
  }
});

// Save or Update a 30-Minute Slot Task for authenticated user ONLY
router.post('/slot', async (req: AuthenticatedRequest, res) => {
  try {
    const { weekStart, slotKey, plannedTask, actualTask, category, planned, actual, status, notes, isProductive, clearProductive } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    if (!weekStart || !slotKey) {
      return res.status(400).json({ error: 'weekStart and slotKey are required' });
    }

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }

    const slotDate = slotKey.split('_')[0];
    if (!isValidDateRange(slotDate)) {
      return res.status(400).json({ error: 'Invalid date in slotKey: must be between 1800-01-01 and 2200-12-31' });
    }

    const slotObj: Record<string, any> = {
      plannedTask: plannedTask || '',
      actualTask: actualTask || plannedTask || '',
      category: category || 'General',
      planned: isNaN(parseInt(planned, 10)) ? 30 : parseInt(planned, 10),
      actual: actual !== undefined && !isNaN(parseInt(actual, 10)) ? parseInt(actual, 10) : 0,
      status: status || 'Pending',
      notes: notes || ''
    };

    const shouldClear = clearProductive === true || isProductive === null;
    const prodVal = typeof isProductive === 'boolean' ? isProductive : null;

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
    // Finding 45 fix: If isProductive is omitted or non-boolean, preserve existing database value via COALESCE.
    // Explicit clear is supported when clearProductive === true or isProductive === null.
    if (weekId) {
      const upsertRes = await executeQuery(
        `INSERT INTO schedule_slots (week_id, slot_key, planned_task, actual_task, category, planned_duration, actual_duration, status, notes, is_productive)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (week_id, slot_key) DO UPDATE 
         SET planned_task = EXCLUDED.planned_task,
             actual_task = EXCLUDED.actual_task,
             category = EXCLUDED.category,
             planned_duration = EXCLUDED.planned_duration,
             actual_duration = EXCLUDED.actual_duration,
             status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             is_productive = CASE 
               WHEN $11 = TRUE THEN NULL
               WHEN EXCLUDED.is_productive IS NOT NULL THEN EXCLUDED.is_productive
               ELSE schedule_slots.is_productive
             END,
             updated_at = CURRENT_TIMESTAMP
         RETURNING is_productive`,
        [weekId, slotKey, slotObj.plannedTask, slotObj.actualTask, slotObj.category, slotObj.planned, slotObj.actual, slotObj.status, slotObj.notes, prodVal, shouldClear]
      );

      const savedProd = upsertRes.rows[0]?.is_productive;
      if (savedProd !== null && savedProd !== undefined) {
        slotObj.isProductive = savedProd;
      }
    }

    // Memory Store Cache
    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    if (!weekId) {
      const existingMemSlot = memoryStore.scheduleWeeks[userWeekKey].slots[slotKey];
      if (shouldClear) {
        delete slotObj.isProductive;
      } else if (typeof isProductive === 'boolean') {
        slotObj.isProductive = isProductive;
      } else if (existingMemSlot && typeof existingMemSlot.isProductive === 'boolean') {
        slotObj.isProductive = existingMemSlot.isProductive;
      }
    }
    memoryStore.scheduleWeeks[userWeekKey].slots[slotKey] = slotObj;

    res.json({ message: 'Slot saved successfully', slotKey, slot: slotObj });
  } catch (err: any) {
    sendError(res, 500, err);
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

    if (!weekStart || !slotKey) {
      return res.status(400).json({ error: 'weekStart and slotKey are required' });
    }

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }

    let deleted = false;

    const userWeekKey = `${userId}_${weekStart}`;
    if (memoryStore.scheduleWeeks[userWeekKey] && memoryStore.scheduleWeeks[userWeekKey].slots && memoryStore.scheduleWeeks[userWeekKey].slots[slotKey]) {
      delete memoryStore.scheduleWeeks[userWeekKey].slots[slotKey];
      deleted = true;
    }

    try {
      const delRes = await executeQuery(
        `DELETE FROM schedule_slots WHERE slot_key = $1 AND week_id IN (SELECT id FROM schedule_weeks WHERE start_date = $2::date AND user_id = $3)`,
        [slotKey, weekStart, userId]
      );
      if (delRes && typeof delRes.rowCount === 'number') {
        deleted = delRes.rowCount > 0 || deleted;
      }
    } catch (e: any) {
      if (process.env.NODE_ENV === 'production') throw e;
      console.warn('PostgreSQL schedule slot delete fallback');
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Schedule slot not found or unauthorized' });
    }

    res.json({ message: 'Slot cleared successfully', slotKey });
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

export default router;
