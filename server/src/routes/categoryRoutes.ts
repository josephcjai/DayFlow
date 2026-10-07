/**
 * User Custom Categories Routes
 * Supports full CRUD: create, list, modify, soft-delete (archive) with system protection
 */
import { Router } from 'express';
import { memoryStore, executeQuery } from '../db/db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isValidUuid } from '../utils/uuidValidation.js';
import { sendError } from '../utils/errorHandler.js';

const router = Router();
router.use(authMiddleware);

export const DEFAULT_USER_CATEGORIES = [
  { name: 'Work', icon: '💼', color: '#3b82f6', isProductive: true, isSystem: false, sortOrder: 0 },
  { name: 'Learning', icon: '📚', color: '#8b5cf6', isProductive: true, isSystem: false, sortOrder: 1 },
  { name: 'Health', icon: '🏃', color: '#f59e0b', isProductive: false, isSystem: false, sortOrder: 2 },
  { name: 'Household', icon: '🧹', color: '#10b981', isProductive: false, isSystem: false, sortOrder: 3 },
  { name: 'Family', icon: '👨‍👩‍👧', color: '#ec4899', isProductive: false, isSystem: false, sortOrder: 4 },
  { name: 'Travel', icon: '✈️', color: '#06b6d4', isProductive: false, isSystem: false, sortOrder: 5 },
  { name: 'General', icon: '📌', color: '#64748b', isProductive: false, isSystem: true, sortOrder: 6 }
];

async function seedDefaultCategoriesForUser(userId: string) {
  for (const cat of DEFAULT_USER_CATEGORIES) {
    await executeQuery(
      `INSERT INTO user_categories (user_id, name, icon, color, is_productive, is_system, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, name) DO NOTHING`,
      [userId, cat.name, cat.icon, cat.color, cat.isProductive, cat.isSystem, cat.sortOrder]
    );
  }
}

// GET /api/categories — List all categories for the user (excludes archived unless ?includeArchived=true)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized access' });

    const includeArchived = req.query.includeArchived === 'true';

    try {
      // Query PostgreSQL
      const query = includeArchived
        ? `SELECT id, name, icon, color, is_productive as "isProductive", is_system as "isSystem", is_archived as "isArchived", sort_order as "sortOrder"
           FROM user_categories
           WHERE user_id = $1
           ORDER BY sort_order ASC, created_at ASC`
        : `SELECT id, name, icon, color, is_productive as "isProductive", is_system as "isSystem", is_archived as "isArchived", sort_order as "sortOrder"
           FROM user_categories
           WHERE user_id = $1 AND is_archived = false
           ORDER BY sort_order ASC, created_at ASC`;

      const result = await executeQuery(query, [userId]);

      if (result.rows.length === 0) {
        // First access: auto-seed defaults
        await seedDefaultCategoriesForUser(userId);
        const seededResult = await executeQuery(query, [userId]);
        return res.json({ categories: seededResult.rows });
      }

      res.json({ categories: result.rows });
    } catch (e: any) {
      if (process.env.NODE_ENV === 'production') throw e;

      // In-Memory Fallback
      if (!memoryStore.categories[userId]) {
        memoryStore.categories[userId] = DEFAULT_USER_CATEGORIES.map((cat, idx) => ({
          id: `mem_cat_${idx}`,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          isProductive: cat.isProductive,
          isSystem: cat.isSystem,
          isArchived: false,
          sortOrder: cat.sortOrder
        }));
      }

      const cats = memoryStore.categories[userId].filter(c => includeArchived || !c.isArchived);
      res.json({ categories: cats });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// POST /api/categories — Create a new custom category
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized access' });

    const { name, icon, color, isProductive, sortOrder } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cleanName = name.trim();
    if (cleanName.length > 50) {
      return res.status(400).json({ error: 'Category name cannot exceed 50 characters' });
    }

    const cleanIcon = (typeof icon === 'string' && icon.trim().length > 0) ? icon.trim().slice(0, 10) : '📌';
    const cleanColor = (typeof color === 'string' && color.trim().length > 0) ? color.trim().slice(0, 30) : '#64748b';
    const cleanIsProductive = Boolean(isProductive);
    const cleanSortOrder = Number.isInteger(sortOrder) ? sortOrder : 0;

    try {
      // Check if an existing category with this name already exists for the user
      const existing = await executeQuery(
        `SELECT id, is_archived FROM user_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
        [userId, cleanName]
      );

      if (existing.rows.length > 0) {
        if (!existing.rows[0].is_archived) {
          return res.status(400).json({ error: `A category named "${cleanName}" already exists` });
        }
        // If it was archived, unarchive and update it
        const unarchiveRes = await executeQuery(
          `UPDATE user_categories
           SET is_archived = false,
               name = $1,
               icon = $2,
               color = $3,
               is_productive = $4,
               sort_order = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND user_id = $7
           RETURNING id, name, icon, color, is_productive as "isProductive", is_system as "isSystem", is_archived as "isArchived", sort_order as "sortOrder"`,
          [cleanName, cleanIcon, cleanColor, cleanIsProductive, cleanSortOrder, existing.rows[0].id, userId]
        );
        return res.status(201).json({ message: 'Category restored and updated successfully', category: unarchiveRes.rows[0] });
      }

      // Insert new category
      const insertRes = await executeQuery(
        `INSERT INTO user_categories (user_id, name, icon, color, is_productive, is_system, is_archived, sort_order)
         VALUES ($1, $2, $3, $4, $5, false, false, $6)
         RETURNING id, name, icon, color, is_productive as "isProductive", is_system as "isSystem", is_archived as "isArchived", sort_order as "sortOrder"`,
        [userId, cleanName, cleanIcon, cleanColor, cleanIsProductive, cleanSortOrder]
      );

      res.status(201).json({ message: 'Category created successfully', category: insertRes.rows[0] });
    } catch (e: any) {
      if (process.env.NODE_ENV === 'production') throw e;

      // In-Memory Fallback
      if (!memoryStore.categories[userId]) memoryStore.categories[userId] = [];
      const newCat = {
        id: `mem_cat_${Date.now()}`,
        name: cleanName,
        icon: cleanIcon,
        color: cleanColor,
        isProductive: cleanIsProductive,
        isSystem: false,
        isArchived: false,
        sortOrder: cleanSortOrder
      };
      memoryStore.categories[userId].push(newCat);
      res.status(201).json({ message: 'Category created successfully', category: newCat });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// PUT /api/categories/:id — Update category (name, icon, color, isProductive, sortOrder)
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized access' });

    if (!isValidUuid(id)) {
      // In-memory check for demo/dev
      const inMem = (memoryStore.categories[userId] || []).find(c => c.id === id);
      if (!inMem && process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Invalid UUID format for category id' });
      }
    }

    const { name, icon, color, isProductive, sortOrder, isArchived } = req.body;

    let cleanName: string | undefined = undefined;
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      cleanName = name.trim();
      if (cleanName.length > 50) {
        return res.status(400).json({ error: 'Category name cannot exceed 50 characters' });
      }
    }

    try {
      // 1. Fetch existing category
      const existingRes = await executeQuery(
        `SELECT id, name, is_system as "isSystem" FROM user_categories WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const current = existingRes.rows[0];

      // Prevent renaming system default category (e.g. General)
      if (cleanName && cleanName !== current.name && current.isSystem) {
        return res.status(400).json({ error: 'Cannot rename the system default category "General"' });
      }

      // Check name uniqueness if renaming
      if (cleanName && cleanName !== current.name) {
        const conflictRes = await executeQuery(
          `SELECT id FROM user_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
          [userId, cleanName, id]
        );
        if (conflictRes.rows.length > 0) {
          return res.status(400).json({ error: `A category named "${cleanName}" already exists` });
        }
      }

      // 2. Perform category update
      const updateRes = await executeQuery(
        `UPDATE user_categories
         SET name = COALESCE($1, name),
             icon = COALESCE($2, icon),
             color = COALESCE($3, color),
             is_productive = COALESCE($4, is_productive),
             sort_order = COALESCE($5, sort_order),
             is_archived = COALESCE($6, is_archived),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND user_id = $8
         RETURNING id, name, icon, color, is_productive as "isProductive", is_system as "isSystem", is_archived as "isArchived", sort_order as "sortOrder"`,
        [
          cleanName || null,
          icon !== undefined ? String(icon).slice(0, 10) : null,
          color !== undefined ? String(color).slice(0, 30) : null,
          typeof isProductive === 'boolean' ? isProductive : null,
          Number.isInteger(sortOrder) ? sortOrder : null,
          typeof isArchived === 'boolean' ? isArchived : null,
          id,
          userId
        ]
      );

      const updatedCategory = updateRes.rows[0];

      // 3. Cascade rename to schedule_slots and todo_items if name changed
      if (cleanName && cleanName !== current.name) {
        await executeQuery(
          `UPDATE schedule_slots 
           SET category = $1 
           WHERE category = $2 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $3)`,
          [cleanName, current.name, userId]
        );

        await executeQuery(
          `UPDATE todo_items 
           SET category = $1 
           WHERE category = $2 AND week_id IN (SELECT id FROM schedule_weeks WHERE user_id = $3)`,
          [cleanName, current.name, userId]
        );
      }

      res.json({ message: 'Category updated successfully', category: updatedCategory });
    } catch (e: any) {
      if (process.env.NODE_ENV === 'production') throw e;

      // In-Memory Fallback
      const list = memoryStore.categories[userId] || [];
      const item = list.find(c => c.id === id);
      if (!item) return res.status(404).json({ error: 'Category not found' });

      if (cleanName && cleanName !== item.name && item.isSystem) {
        return res.status(400).json({ error: 'Cannot rename the system default category "General"' });
      }

      if (cleanName) item.name = cleanName;
      if (icon !== undefined) item.icon = String(icon).slice(0, 10);
      if (color !== undefined) item.color = String(color).slice(0, 30);
      if (typeof isProductive === 'boolean') item.isProductive = isProductive;
      if (typeof isArchived === 'boolean') item.isArchived = isArchived;
      if (Number.isInteger(sortOrder)) item.sortOrder = sortOrder;

      res.json({ message: 'Category updated successfully', category: item });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

// DELETE /api/categories/:id — Soft-delete (archive) category
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ error: 'Unauthorized access' });

    if (!isValidUuid(id)) {
      const inMem = (memoryStore.categories[userId] || []).find(c => c.id === id);
      if (!inMem && process.env.NODE_ENV === 'production') {
        return res.status(400).json({ error: 'Invalid UUID format for category id' });
      }
    }

    try {
      // 1. Fetch category
      const existingRes = await executeQuery(
        `SELECT id, name, is_system as "isSystem" FROM user_categories WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const current = existingRes.rows[0];

      // 2. Protect system default category (General)
      if (current.isSystem) {
        return res.status(400).json({ error: 'Cannot delete the system default category "General"' });
      }

      // 3. Soft-delete (archive)
      await executeQuery(
        `UPDATE user_categories SET is_archived = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      res.json({ message: 'Category archived successfully', id });
    } catch (e: any) {
      if (process.env.NODE_ENV === 'production') throw e;

      // In-Memory Fallback
      const list = memoryStore.categories[userId] || [];
      const item = list.find(c => c.id === id);
      if (!item) return res.status(404).json({ error: 'Category not found' });
      if (item.isSystem) return res.status(400).json({ error: 'Cannot delete the system default category "General"' });

      item.isArchived = true;
      res.json({ message: 'Category archived successfully', id });
    }
  } catch (err: any) {
    sendError(res, 500, err);
  }
});

export default router;
