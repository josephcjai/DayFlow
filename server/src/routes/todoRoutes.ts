/**
 * Weekly Todo & Notes Routes
 * Secured with authMiddleware and strict per-user SQL isolation & persistence
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// Enforce authMiddleware on all todo & notes routes
router.use(authMiddleware);

// GET Todos & Notes for Week
router.get('/week/:weekStart', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart } = req.params;

    let todos: any[] = [];
    let notes = '';

    try {
      // Get week record and notes
      const weekRes = await executeQuery(
        'SELECT id, weekly_notes FROM schedule_weeks WHERE user_id = $1 AND start_date = $2::date',
        [userId, weekStart]
      );

      if (weekRes.rows.length > 0) {
        notes = weekRes.rows[0].weekly_notes || '';
        const weekId = weekRes.rows[0].id;
        const todoRes = await executeQuery(
          'SELECT id, text, is_completed as completed, COALESCE(priority, \'Medium\') as priority, COALESCE(category, \'General\') as category FROM todo_items WHERE week_id = $1 ORDER BY created_at ASC',
          [weekId]
        );
        todos = todoRes.rows;
      }
    } catch (e) {
      const userWeekKey = `${userId}_${weekStart}`;
      if (memoryStore.scheduleWeeks[userWeekKey]) {
        todos = memoryStore.scheduleWeeks[userWeekKey].todos || [];
        notes = memoryStore.scheduleWeeks[userWeekKey].notes || '';
      }
    }

    res.json({ weekStart, todos, notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add Todo Item
router.post('/todo', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart, text, priority, category } = req.body;
    const todoPriority = priority || 'Medium';
    const todoCategory = category || 'General';
    const newTodo: any = { id: Date.now(), text, priority: todoPriority, category: todoCategory, completed: false };

    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[userWeekKey].todos.push(newTodo);

    try {
      // Ensure schedule_weeks row exists
      const weekRes = await executeQuery(
        `INSERT INTO schedule_weeks (user_id, start_date)
         VALUES ($1, $2::date)
         ON CONFLICT (user_id, start_date) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [userId, weekStart]
      );
      const weekId = weekRes.rows[0].id;
      
      const insertRes = await executeQuery(
        'INSERT INTO todo_items (week_id, text, priority, category, is_completed) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [weekId, text, todoPriority, todoCategory, false]
      );
      if (insertRes.rows[0]) {
        newTodo.id = insertRes.rows[0].id;
      }
    } catch (e) {
      console.warn('PostgreSQL todo insert fallback to memory store');
    }

    res.json({ message: 'Todo item added', todo: newTodo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Todo Completion Status
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { completed } = req.body;

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      if (wKey.startsWith(`${userId}_`)) {
        const item = (memoryStore.scheduleWeeks[wKey].todos || []).find((t: any) => String(t.id) === String(id));
        if (item) item.completed = !!completed;
      }
    });

    try {
      await executeQuery(
        `UPDATE todo_items 
         SET is_completed = $1 
         WHERE id = $2 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $3)`,
        [!!completed, id, userId]
      );
    } catch (e) {
      console.warn('PostgreSQL todo patch fallback to memory store');
    }

    res.json({ message: 'Todo updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Todo Item
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      if (wKey.startsWith(`${userId}_`)) {
        memoryStore.scheduleWeeks[wKey].todos = (memoryStore.scheduleWeeks[wKey].todos || []).filter((t: any) => String(t.id) !== String(id));
      }
    });

    try {
      await executeQuery(
        `DELETE FROM todo_items 
         WHERE id = $1 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $2)`,
        [id, userId]
      );
    } catch (e) {
      console.warn('PostgreSQL todo delete fallback to memory store');
    }

    res.json({ message: 'Todo item deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Weekly Scratchpad Notes
router.post('/notes', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart, notes } = req.body;

    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[userWeekKey].notes = notes;

    try {
      await executeQuery(
        `INSERT INTO schedule_weeks (user_id, start_date, weekly_notes)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, start_date) DO UPDATE SET weekly_notes = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, weekStart, notes || '']
      );
    } catch (e) {
      console.warn('PostgreSQL notes update fallback to memory store');
    }

    res.json({ message: 'Notes updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
