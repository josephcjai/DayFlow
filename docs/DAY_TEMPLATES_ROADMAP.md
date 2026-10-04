# 📋 Day Templates — Future Roadmap & Cloud Sync Architecture

This document outlines the planned future enhancements for **Day Templates**, specifically transitioning template definitions (blueprints) from browser `localStorage` to **PostgreSQL Cloud Synchronization** for multi-device support.

---

## 🎯 Executive Summary & Context

In **v2.6.0**, DayFlow introduced reusable **Day Templates**:
- Users can create, edit, and delete day routines in **User Settings** (Card 7).
- Applying a template follows the **Least Priority Rule** (filling only empty 30-minute slots without overwriting existing tasks).
- **Current Storage Model:**
  - **Applied Schedule Slots:** Written directly to the live PostgreSQL database (`schedule_slots` table) via `POST /api/schedule/slot`. These are 100% cloud-synced across all devices.
  - **Template Definitions (Blueprints):** Currently persisted in browser `localStorage` scoped to the user (`settings_dayflow_data_<userId>`). If a user switches computers or clears browser cache, their custom routine definitions are not synced from the cloud (though their schedule grid remains intact).

This roadmap specifies the migration to full **Multi-Device Cloud Persistence** in an upcoming release (v2.7.0).

---

## 🏗️ Architecture Specification (Target: v2.7.0)

### 1. Database Schema (`user_day_templates`)

A new PostgreSQL table dedicated to user-defined routines:

```sql
CREATE TABLE IF NOT EXISTS user_day_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slots JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_day_templates_user_id 
    ON user_day_templates(user_id);
```

#### JSONB `slots` Structure:
```json
{
  "09:00": { "title": "Standup & Priorities", "plannedTask": "Standup & Priorities", "category": "Work", "planned": 30 },
  "09:30": { "title": "Deep Work: Core Priorities", "plannedTask": "Deep Work: Core Priorities", "category": "Work", "planned": 30 },
  "10:00": { "title": "Deep Work: Core Priorities", "plannedTask": "Deep Work: Core Priorities", "category": "Work", "planned": 30 }
}
```

---

### 2. REST API Endpoints (`/api/templates`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/templates` | Fetch all templates belonging to authenticated user | Yes (JWT) |
| `POST` | `/api/templates` | Create a new custom template | Yes (JWT) |
| `PUT` | `/api/templates/:id` | Update an existing template | Yes (JWT) |
| `DELETE` | `/api/templates/:id` | Delete a template by ID | Yes (JWT) |

#### Sample Responses:
- **`GET /api/templates`**
  ```json
  {
    "templates": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Productive Workday",
        "description": "Standard deep focus schedule",
        "slots": { ... },
        "createdAt": "2026-09-30T10:00:00Z"
      }
    ]
  }
  ```

---

### 3. Client-Side Synchronization & Offline-First Strategy

1. **On Login / App Startup:**
   - DayFlow fetches templates via `GET /api/templates`.
   - Merges remote templates with local `localStorage` templates (using `updatedAt` timestamp for conflict resolution).
2. **On Template Save / Update:**
   - Saves immediately to `localStorage` for instant UI reactivity.
   - Asynchronously syncs to `POST /api/templates` or `PUT /api/templates/:id`.
   - If offline, queues the action in `pendingTemplateSaves` and retries upon reconnection.
3. **On Template Delete:**
   - Shows `#deleteDayTemplateConfirmModal` (themed modal).
   - Deletes locally and dispatches `DELETE /api/templates/:id`.
4. **Demo Mode / Guest Mode:**
   - Falls back automatically to `localStorage` without attempting API calls.

---

### 4. Implementation Phasing

| Phase | Milestone | Deliverables | Status |
|---|---|---|:---:|
| **Phase 1** | Schema & Migration | Create `user_day_templates` table and run via `server/src/db/migrate.ts`. | ✅ **Completed** |
| **Phase 2** | Backend REST API | Implement `server/src/routes/templateRoutes.ts` with input validation and OpenAPI spec. | ✅ **Completed** |
| **Phase 3** | Frontend Integration | Update `src/js/settings.js` and `src/js/apiClient.js` to fetch and sync templates with server. | ✅ **Completed** |
| **Phase 4** | E2E QA Verification | Extend `dayflow-qa` test suite with cross-browser and offline sync tests. | ⏳ Ready for QA |
