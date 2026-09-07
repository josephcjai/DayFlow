/**
 * Weekly Todo & Notes Routes
 * Secured with authMiddleware and strict per-user SQL isolation & persistence
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isValidDateRange } from '../utils/dateValidation.js';

const router = Router();

// Enforce authMiddleware on all todo & notes routes
router.use(authMiddleware);

// GET Todos & Notes for Week
router.get('/week/:weekStart', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart } = req.params;

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }

    let todos: any[] = [];
    let notes = '';
    let noteSheets: any[] = [];

    const defaultSheets = (journalText: string) => [
      { id: 'journal', title: 'Weekly Journal', icon: '📓', content: journalText || '', isDefault: true },
      { id: 'tech', title: 'Tech & Architecture', icon: '💻', content: '', isDefault: true },
      { id: 'backlog', title: 'Sprint Backlog', icon: '💼', content: '', isDefault: true },
      { id: 'scratchpad', title: 'Quick Scratchpad', icon: '⚡', content: '', isDefault: true }
    ];

    try {
      // Get week record, notes, and note_sheets
      const weekRes = await executeQuery(
        'SELECT id, weekly_notes, note_sheets FROM schedule_weeks WHERE user_id = $1 AND start_date = $2::date',
        [userId, weekStart]
      );

      if (weekRes.rows.length > 0) {
        notes = weekRes.rows[0].weekly_notes || '';
        const rawSheets = weekRes.rows[0].note_sheets;
        if (Array.isArray(rawSheets) && rawSheets.length > 0) {
          noteSheets = rawSheets;
        } else {
          noteSheets = defaultSheets(notes);
        }

        const weekId = weekRes.rows[0].id;
        const todoRes = await executeQuery(
          'SELECT id, text, is_completed as completed, COALESCE(priority, \'Medium\') as priority, COALESCE(category, \'General\') as category, to_char(due_date, \'YYYY-MM-DD\') as "dueDate" FROM todo_items WHERE week_id = $1 ORDER BY created_at ASC',
          [weekId]
        );
        todos = todoRes.rows;
      } else {
        noteSheets = defaultSheets('');
      }
    } catch (e) {
      const userWeekKey = `${userId}_${weekStart}`;
      if (memoryStore.scheduleWeeks[userWeekKey]) {
        todos = memoryStore.scheduleWeeks[userWeekKey].todos || [];
        notes = memoryStore.scheduleWeeks[userWeekKey].notes || '';
        noteSheets = memoryStore.scheduleWeeks[userWeekKey].noteSheets || defaultSheets(notes);
      } else {
        noteSheets = defaultSheets('');
      }
    }

    res.json({ weekStart, todos, notes, noteSheets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add Todo Item
router.post('/todo', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart, text, priority, category, dueDate } = req.body;

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }
    if (dueDate && !isValidDateRange(dueDate)) {
      return res.status(400).json({ error: 'Invalid dueDate: must be between 1800-01-01 and 2200-12-31' });
    }

    const todoPriority = priority || 'Medium';
    const todoCategory = category || 'General';
    const formattedDueDate = dueDate && isValidDateRange(dueDate) ? dueDate : null;
    const newTodo: any = { id: Date.now(), text, priority: todoPriority, category: todoCategory, completed: false, dueDate: formattedDueDate };

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
        'INSERT INTO todo_items (week_id, text, priority, category, is_completed, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, to_char(due_date, \'YYYY-MM-DD\') as "dueDate"',
        [weekId, text, todoPriority, todoCategory, false, formattedDueDate]
      );
      if (insertRes.rows[0]) {
        newTodo.id = insertRes.rows[0].id;
        newTodo.dueDate = insertRes.rows[0].dueDate || formattedDueDate;
      }
    } catch (e) {
      console.warn('PostgreSQL todo insert fallback to memory store');
    }

    res.json({ message: 'Todo item added', todo: newTodo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Todo Completion Status & Due Date
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { completed, dueDate } = req.body;

    if (dueDate && !isValidDateRange(dueDate)) {
      return res.status(400).json({ error: 'Invalid dueDate: must be between 1800-01-01 and 2200-12-31' });
    }

    let updated = false;

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      if (wKey.startsWith(`${userId}_`)) {
        const item = (memoryStore.scheduleWeeks[wKey].todos || []).find((t: any) => String(t.id) === String(id));
        if (item) {
          if (completed !== undefined) item.completed = !!completed;
          if (dueDate !== undefined) item.dueDate = dueDate;
          updated = true;
        }
      }
    });

    try {
      let patchRes;
      if (dueDate !== undefined && completed !== undefined) {
        patchRes = await executeQuery(
          `UPDATE todo_items 
           SET is_completed = $1, due_date = $2 
           WHERE id = $3 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $4)`,
          [!!completed, dueDate || null, id, userId]
        );
      } else if (dueDate !== undefined) {
        patchRes = await executeQuery(
          `UPDATE todo_items 
           SET due_date = $1 
           WHERE id = $2 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $3)`,
          [dueDate || null, id, userId]
        );
      } else {
        patchRes = await executeQuery(
          `UPDATE todo_items 
           SET is_completed = $1 
           WHERE id = $2 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $3)`,
          [!!completed, id, userId]
        );
      }
      if (patchRes && typeof patchRes.rowCount === 'number') {
        updated = patchRes.rowCount > 0;
      }
    } catch (e) {
      console.warn('PostgreSQL todo patch fallback to memory store');
    }

    if (!updated) {
      return res.status(404).json({ error: 'Todo item not found or unauthorized' });
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

    let deleted = false;

    Object.keys(memoryStore.scheduleWeeks).forEach(wKey => {
      if (wKey.startsWith(`${userId}_`)) {
        const prevLen = (memoryStore.scheduleWeeks[wKey].todos || []).length;
        memoryStore.scheduleWeeks[wKey].todos = (memoryStore.scheduleWeeks[wKey].todos || []).filter((t: any) => String(t.id) !== String(id));
        if (memoryStore.scheduleWeeks[wKey].todos.length < prevLen) {
          deleted = true;
        }
      }
    });

    try {
      const delRes = await executeQuery(
        `DELETE FROM todo_items 
         WHERE id = $1 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $2)`,
        [id, userId]
      );
      if (delRes && typeof delRes.rowCount === 'number') {
        deleted = delRes.rowCount > 0;
      }
    } catch (e) {
      console.warn('PostgreSQL todo delete fallback to memory store');
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Todo item not found or unauthorized' });
    }

    res.json({ message: 'Todo item deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Weekly Scratchpad Notes & Multi-Sheets
router.post('/notes', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { weekStart, notes, noteSheets } = req.body;

    if (!isValidDateRange(weekStart)) {
      return res.status(400).json({ error: 'Invalid date: weekStart must be between 1800-01-01 and 2200-12-31' });
    }

    // Determine legacy weekly_notes string (primary journal sheet content or notes param)
    const primarySheet = Array.isArray(noteSheets) ? noteSheets.find((s: any) => s.id === 'journal') : null;
    const legacyNotes = primarySheet ? (primarySheet.content || '') : (notes || '');

    const userWeekKey = `${userId}_${weekStart}`;
    if (!memoryStore.scheduleWeeks[userWeekKey]) {
      memoryStore.scheduleWeeks[userWeekKey] = { slots: {}, habits: [], todos: [], notes: '', noteSheets: [] };
    }
    memoryStore.scheduleWeeks[userWeekKey].notes = legacyNotes;
    if (noteSheets) {
      memoryStore.scheduleWeeks[userWeekKey].noteSheets = noteSheets;
    }

    try {
      if (noteSheets && Array.isArray(noteSheets)) {
        await executeQuery(
          `INSERT INTO schedule_weeks (user_id, start_date, weekly_notes, note_sheets)
           VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (user_id, start_date) DO UPDATE SET weekly_notes = $3, note_sheets = $4::jsonb, updated_at = CURRENT_TIMESTAMP`,
          [userId, weekStart, legacyNotes, JSON.stringify(noteSheets)]
        );
      } else {
        await executeQuery(
          `INSERT INTO schedule_weeks (user_id, start_date, weekly_notes)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, start_date) DO UPDATE SET weekly_notes = $3, updated_at = CURRENT_TIMESTAMP`,
          [userId, weekStart, legacyNotes]
        );
      }
    } catch (e) {
      console.warn('PostgreSQL notes update fallback to memory store');
    }

    res.json({ message: 'Notes updated successfully', noteSheets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
