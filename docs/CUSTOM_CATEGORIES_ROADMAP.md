# 🏷️ Custom Task Categories — Development Roadmap & Technical Specifications
## Dynamic Category Management, Archival Strategy, and Multi-Device Persistence

**Status:** Completed (Ready for Local Testing & Promotion)  
**Target Milestone:** **`v2.9.0`**  
**Author:** DayFlow Engineering  
**Approved Strategy:** Soft Deletion & Archival with Protected System Default  
**Implementation Status:** All phases (Backend, Frontend, Settings UI, Grid/Todo badges, Analytics) implemented and committed locally.  

---

## 1. Executive Summary & Problem Statement

Currently, DayFlow provides 7 fixed task categories (`Work`, `Learning`, `Health`, `Household`, `Family`, `Travel`, `General`) hardcoded into client JavaScript arrays and static HTML select elements.

In **v2.9.0**, DayFlow will introduce **Full Category Customization**, empowering users to:
1. **Add** custom categories tailored to their personal workflow (e.g., *"Client Projects"*, *"Fitness & Gym"*, *"Side Hustle"*, *"Reading"*).
2. **Modify** category properties (name, emoji icon, color swatch, and default productive classification).
3. **Delete / Archive** categories they no longer use, while **protecting historical records and past analytics reports from corruption**.

---

## 2. Past Entry Handling & Archival Strategy

When a category is deleted, historical schedule slots, todo checklist items, and day templates may reference that category name. 

### Selected Approach: Soft Deletion & Archival (Option B)

```
Active Categories (Dropdowns & New Tasks)      Archived Categories (Past Slots & Analytics)
┌──────────────────────────────────────┐       ┌──────────────────────────────────────────┐
│ 💼 Work          (Productive)        │       │ ✈️ Travel        (Archived — Kept in DB) │
│ 📚 Learning      (Productive)        │       └──────────────────────────────────────────┘
│ 🏃 Health        (Standard)          │                             │
│ 📌 General       (System Protected)  │◄──────── Fallback Link ─────┘
└──────────────────────────────────────┘   (If slot has no category or dangling reference)
```

1. **Zero Data Loss for Past Entries:**
   - Categories will not be hard-deleted from the database. Instead, deleting a category marks it as `is_archived = true`.
   - Historical schedule slots (`schedule_slots`) and completed todos (`todo_items`) keep their original category tag.
   - Past Focus Analytics reports (Day, Week, Month) retain full fidelity and exact historical distribution.
2. **Clean Dropdowns for New Tasks:**
   - Archived categories are excluded from selection dropdowns for new slots (Task Editor modal, Todo item creator, Bulk Action menu).
   - If a past slot with an archived category is opened for editing, the modal displays the category with an `(Archived)` badge, allowing the user to either keep it or switch to an active category.
3. **Protected System Fallback (`General`):**
   - The system category **`General`** (`is_system = true`) is permanently locked: it **cannot be deleted or renamed**.
   - If an imported template or legacy slot has no category assigned or references an invalid identifier, it automatically falls back to `General`.

---

## 3. Database Architecture (`user_categories`)

A dedicated PostgreSQL table provides cloud-synced, per-user category definitions:

```sql
CREATE TABLE IF NOT EXISTS user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(10) NOT NULL DEFAULT '📌',
    color VARCHAR(30) NOT NULL DEFAULT '#64748b',
    is_productive BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_category_name UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_id 
    ON user_categories(user_id) WHERE is_archived = false;
```

### Automatic Seeding for Existing and New Users
A migration script automatically seeds the 7 default categories for every existing user:
- `Work` (Icon: `💼`, Color: `#3b82f6`, `is_productive = true`)
- `Learning` (Icon: `📚`, Color: `#8b5cf6`, `is_productive = true`)
- `Health` (Icon: `🏃`, Color: `#f59e0b`, `is_productive = false`)
- `Household` (Icon: `🧹`, Color: `#10b981`, `is_productive = false`)
- `Family` (Icon: `👨‍👩‍👧`, Color: `#ec4899`, `is_productive = false`)
- `Travel` (Icon: `✈️`, Color: `#06b6d4`, `is_productive = false`)
- `General` (Icon: `📌`, Color: `#64748b`, `is_productive = false`, `is_system = true`)

---

## 4. REST API Specification (`/api/categories`)

All endpoints require JWT authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/categories` | Returns all categories for the authenticated user (`includeArchived=true` query param optional). |
| `POST` | `/api/categories` | Creates a new category (`name`, `icon`, `color`, `isProductive`, `sortOrder`). |
| `PUT` | `/api/categories/:id` | Updates an existing category's properties. Renaming propagates to active slots or updates alias. |
| `DELETE` | `/api/categories/:id` | Soft-deletes (archives) the category. Returns `400 Bad Request` if attempting to delete `General` (`is_system = true`). |
| `POST` | `/api/categories/:id/restore` | Restores an archived category back to active status. |

---

## 5. Frontend & UI Architecture Impact

### 5.1 Dynamic Select Hydration
- Remove static `<option>` tags from `index.html` (`#taskCategorySelect`, `#todoCategorySelect`, `#bulkCategoryMenu`, `#categoryFilterSelect`).
- Implement dynamic hydration function `renderCategoryDropdowns()` called upon initial app boot and whenever categories are updated.

### 5.2 Settings Category Manager Card
In **Settings → Section B (Gamification, Goals & Effectiveness)**:
- Add a new **Category Management** card:
  - Interactive table/list of active categories showing Icon, Name, Color swatch, and "⚡ Productive" pill.
  - Action buttons: **"+ Add Category"**, **"Edit"**, and **"Archive"**.
  - Protected badge on `General` disabling the Archive action.
  - Category Creation/Edit modal with emoji picker and curated color palette (12 modern accessible colors).

### 5.3 Work Effectiveness & Analytics Integration
- **Work Effectiveness KPI:** Automatically evaluates `isProductive` by looking up the category's `is_productive` flag in `STATE.categories`.
- **Focus Analytics Time Breakdown:** Progress bar colors and labels dynamically match the user's custom category colors instead of hardcoded CSS variables.

### 5.4 Mobile App Contract Alignment
- Provides `GET /api/categories` schema to the `DayFlow-Mobile` Android Kotlin client, enabling the mobile task editor and filters to stay synchronized with web user settings.

---

## 6. Phasing & Release Plan

1. **Step 1 (Current):** Complete and deploy **`v2.8.0`** (Work Effectiveness KPI, 2-column Settings layout, and Finding 45 API fix).
2. **Step 2 (v2.9.0 Sprint 1):** Backend implementation — Database migration `user_categories`, seed script, and `/api/categories` CRUD routes.
3. **Step 3 (v2.9.0 Sprint 2):** Frontend implementation — Category Manager settings UI, modal color/icon pickers, dynamic select hydration.
4. **Step 4 (v2.9.0 Sprint 3):** Analytics & Mobile integration — Dynamic color rendering in Focus Analytics, Android API contract alignment.
