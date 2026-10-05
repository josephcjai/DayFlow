/**
 * Day Templates Routes (Strict User Isolation & PostgreSQL Cloud Persistence)
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendError } from '../utils/errorHandler.js';

const router = Router();
router.use(authMiddleware);

export const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl_workday',
    name: 'Productive Workday',
    description: 'Standard deep focus schedule with morning standup, deep work, and afternoon development',
    isDefault: true,
    slots: {
      '09:00': { title: 'Morning Standup & Priorities', plannedTask: 'Morning Standup & Priorities', category: 'Work', planned: 30 },
      '09:30': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '10:00': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '10:30': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '11:00': { title: 'Deep Work: Core Priorities', plannedTask: 'Deep Work: Core Priorities', category: 'Work', planned: 30 },
      '11:30': { title: 'Team Sync & Code Reviews', plannedTask: 'Team Sync & Code Reviews', category: 'Work', planned: 30 },
      '12:00': { title: 'Lunch & Recharge Walk', plannedTask: 'Lunch & Recharge Walk', category: 'Health', planned: 30 },
      '12:30': { title: 'Lunch & Recharge Walk', plannedTask: 'Lunch & Recharge Walk', category: 'Health', planned: 30 },
      '13:00': { title: 'Email & Admin Catch-up', plannedTask: 'Email & Admin Catch-up', category: 'Work', planned: 30 },
      '13:30': { title: 'Task Breakdown & Planning', plannedTask: 'Task Breakdown & Planning', category: 'Work', planned: 30 },
      '14:00': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '14:30': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '15:00': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '15:30': { title: 'Architecture & Feature Development', plannedTask: 'Architecture & Feature Development', category: 'Work', planned: 30 },
      '16:00': { title: 'Architecture & System Review', plannedTask: 'Architecture & System Review', category: 'Work', planned: 30 },
      '16:30': { title: 'Daily Wrap-up & Tomorrow Prep', plannedTask: 'Daily Wrap-up & Tomorrow Prep', category: 'Work', planned: 30 }
    }
  },
  {
    id: 'tmpl_weekend',
    name: 'Weekend Reset & Leisure',
    description: 'Relaxed weekend schedule balancing health, personal learning, and family time',
    isDefault: true,
    slots: {
      '09:00': { title: 'Morning Workout', plannedTask: 'Morning Workout', category: 'Health', planned: 30 },
      '09:30': { title: 'Healthy Breakfast', plannedTask: 'Healthy Breakfast', category: 'Health', planned: 30 },
      '10:30': { title: 'Personal Learning & Tech Reading', plannedTask: 'Personal Learning & Tech Reading', category: 'Learning', planned: 30 },
      '11:00': { title: 'Personal Learning & Tech Reading', plannedTask: 'Personal Learning & Tech Reading', category: 'Learning', planned: 30 },
      '13:00': { title: 'Household Organization', plannedTask: 'Household Organization', category: 'Household', planned: 30 },
      '13:30': { title: 'Household Errands', plannedTask: 'Household Errands', category: 'Household', planned: 30 },
      '16:00': { title: 'Family Time & Recreation', plannedTask: 'Family Time & Recreation', category: 'Family', planned: 30 },
      '16:30': { title: 'Family Time & Recreation', plannedTask: 'Family Time & Recreation', category: 'Family', planned: 30 }
    }
  }
];

function sanitizeSlots(rawSlots: any): Record<string, any> {
  if (!rawSlots || typeof rawSlots !== 'object') return {};
  const cleaned: Record<string, any> = {};
  for (const [key, slot] of Object.entries(rawSlots)) {
    // Validate that slot key is a strictly aligned 30-min grid slot (00:00 to 23:30) (Finding 43)
    if (!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(key)) continue;
    const s = slot as any;
    if (!s || typeof s !== 'object') continue;
    const title = String(s.title || s.plannedTask || 'Task').trim().slice(0, 255);
    cleaned[key] = {
      title,
      plannedTask: title,
      category: String(s.category || 'General').trim().slice(0, 50),
      planned: 30,
      notes: s.notes ? String(s.notes).slice(0, 500) : ''
    };
  }
  return cleaned;
}

// 1. GET /api/templates - Fetch all templates for authenticated user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    try {
      const result = await executeQuery(
        `SELECT id, name, description, slots, is_default AS "isDefault", 
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM user_day_templates 
         WHERE user_id = $1 
         ORDER BY created_at ASC`,
        [userId]
      );

      return res.json({ templates: result.rows });
    } catch (dbErr: any) {
      // Memory Store Fallback
      const userTemplates = memoryStore.dayTemplates[userId] || [];
      return res.json({ templates: userTemplates });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// 2. POST /api/templates - Create or Upsert Day Template
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    const { id, name, description, slots, isDefault } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required (max 100 characters)' });
    }

    const trimmedName = name.trim().slice(0, 100);
    const trimmedDesc = description ? String(description).trim().slice(0, 500) : '';
    const templateId = (id && typeof id === 'string' && id.trim().length > 0)
      ? id.trim().slice(0, 64)
      : `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const cleanedSlots = sanitizeSlots(slots);
    const defaultFlag = Boolean(isDefault);

    try {
      const result = await executeQuery(
        `INSERT INTO user_day_templates (id, user_id, name, description, slots, is_default, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, id) DO UPDATE 
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             slots = EXCLUDED.slots,
             is_default = EXCLUDED.is_default,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id, name, description, slots, is_default AS "isDefault", 
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [templateId, userId, trimmedName, trimmedDesc, JSON.stringify(cleanedSlots), defaultFlag]
      );

      const template = result.rows[0];

      // Update memory store if present
      if (!memoryStore.dayTemplates[userId]) memoryStore.dayTemplates[userId] = [];
      const memIdx = memoryStore.dayTemplates[userId].findIndex(t => t.id === templateId);
      if (memIdx >= 0) {
        memoryStore.dayTemplates[userId][memIdx] = template;
      } else {
        memoryStore.dayTemplates[userId].push(template);
      }

      return res.status(201).json({ message: 'Template saved successfully', template });
    } catch (dbErr: any) {
      // Memory Store fallback
      const template = {
        id: templateId,
        name: trimmedName,
        description: trimmedDesc,
        slots: cleanedSlots,
        isDefault: defaultFlag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!memoryStore.dayTemplates[userId]) memoryStore.dayTemplates[userId] = [];
      const memIdx = memoryStore.dayTemplates[userId].findIndex(t => t.id === templateId);
      if (memIdx >= 0) {
        memoryStore.dayTemplates[userId][memIdx] = template;
      } else {
        memoryStore.dayTemplates[userId].push(template);
      }
      return res.status(201).json({ message: 'Template saved successfully (in-memory)', template });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// 3. PUT /api/templates/:id - Update an existing Day Template
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    const { id } = req.params;
    if (!id || id.length > 64) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const { name, description, slots, isDefault } = req.body;
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'Template name cannot be empty' });
    }

    const trimmedName = name !== undefined ? name.trim().slice(0, 100) : null;
    const trimmedDesc = description !== undefined ? String(description).trim().slice(0, 500) : null;
    const cleanedSlotsJson = slots !== undefined ? JSON.stringify(sanitizeSlots(slots)) : null;
    const defaultFlag = isDefault !== undefined ? Boolean(isDefault) : null;

    try {
      const result = await executeQuery(
        `UPDATE user_day_templates
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             slots = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE slots END,
             is_default = COALESCE($4, is_default),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5 AND id = $6
         RETURNING id, name, description, slots, is_default AS "isDefault", 
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [trimmedName, trimmedDesc, cleanedSlotsJson, defaultFlag, userId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const template = result.rows[0];
      if (memoryStore.dayTemplates[userId]) {
        const memIdx = memoryStore.dayTemplates[userId].findIndex(t => t.id === id);
        if (memIdx >= 0) memoryStore.dayTemplates[userId][memIdx] = template;
      }

      return res.json({ message: 'Template updated successfully', template });
    } catch (dbErr: any) {
      // Memory Store fallback
      if (memoryStore.dayTemplates[userId]) {
        const memIdx = memoryStore.dayTemplates[userId].findIndex(t => t.id === id);
        if (memIdx >= 0) {
          const existing = memoryStore.dayTemplates[userId][memIdx];
          const updated = {
            ...existing,
            ...(trimmedName !== null ? { name: trimmedName } : {}),
            ...(trimmedDesc !== null ? { description: trimmedDesc } : {}),
            ...(slots !== undefined ? { slots: sanitizeSlots(slots) } : {}),
            ...(defaultFlag !== null ? { isDefault: defaultFlag } : {}),
            updatedAt: new Date().toISOString()
          };
          memoryStore.dayTemplates[userId][memIdx] = updated;
          return res.json({ message: 'Template updated successfully (in-memory)', template: updated });
        }
      }
      return res.status(404).json({ error: 'Template not found' });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// 4. DELETE /api/templates/:id - Delete a Day Template
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    const { id } = req.params;
    if (!id || id.length > 64) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    try {
      const result = await executeQuery(
        `DELETE FROM user_day_templates 
         WHERE user_id = $1 AND id = $2 
         RETURNING id, name`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (memoryStore.dayTemplates[userId]) {
        memoryStore.dayTemplates[userId] = memoryStore.dayTemplates[userId].filter(t => t.id !== id);
      }

      return res.json({ message: 'Template deleted successfully', id });
    } catch (dbErr: any) {
      if (memoryStore.dayTemplates[userId]) {
        const prevLen = memoryStore.dayTemplates[userId].length;
        memoryStore.dayTemplates[userId] = memoryStore.dayTemplates[userId].filter(t => t.id !== id);
        if (memoryStore.dayTemplates[userId].length < prevLen) {
          return res.json({ message: 'Template deleted successfully (in-memory)', id });
        }
      }
      return res.status(404).json({ error: 'Template not found' });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

export default router;
