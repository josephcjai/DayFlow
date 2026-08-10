/**
 * Weekly Todo & Notes Routes
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';

const router = Router();

// GET Todos & Notes for Week
router.get('/week/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const resPg = await executeQuery(
      `SELECT t.id, t.text, t.is_completed as completed 
       FROM todo_items t 
       JOIN schedule_weeks w ON t.week_id = w.id 
       WHERE w.start_date = $1`,
      [weekStart]
    );

    let todos = resPg.rows;
    let notes = '';

    if (memoryStore.scheduleWeeks[weekStart]) {
      if (todos.length === 0) todos = memoryStore.scheduleWeeks[weekStart].todos || [];
      notes = memoryStore.scheduleWeeks[weekStart].notes || '';
    }

    res.json({ weekStart, todos, notes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add Todo Item
router.post('/todo', async (req, res) => {
  try {
    const { weekStart, text } = req.body;
    const newTodo = { id: Date.now(), text, completed: false };

    if (!memoryStore.scheduleWeeks[weekStart]) {
      memoryStore.scheduleWeeks[weekStart] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[weekStart].todos.push(newTodo);

    res.json({ message: 'Todo item added', todo: newTodo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Weekly Scratchpad Notes
router.post('/notes', async (req, res) => {
  try {
    const { weekStart, notes } = req.body;
    if (!memoryStore.scheduleWeeks[weekStart]) {
      memoryStore.scheduleWeeks[weekStart] = { slots: {}, habits: [], todos: [], notes: '' };
    }
    memoryStore.scheduleWeeks[weekStart].notes = notes;

    res.json({ message: 'Notes updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
