# DayFlow v2.7.0 — Production Deployment Runbook
## Multi-Slot Selection, Floating Bulk Actions, and Day Templates Cloud Persistence Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.6.0` (Commit `21b96d5`) |
| **Target Release Version** | **`v2.7.0`** (Commit `c28e3f9`) |
| **Target Git Tag** | **`v2.7.0`** on branch `main` |
| **Deployment Type** | In-place zero-downtime upgrade (Additive DB Migration + API Rebuild + PM2 Graceful Reload + Cache Invalidation) |
| **Database Migration** | **YES** (Additive Step 5: `user_day_templates` table + index; zero lock contention) |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's New in `v2.7.0`:
1. **Multi-Slot Selection & Floating Bulk Action Bar:**
   - **Ctrl+Click** (Windows/Linux) / **Cmd+Click** (Mac) to toggle multi-selection of individual slots across days and times.
   - **Shift+Click** for 2D rectangular grid range selection between an anchor slot and target slot.
   - **Floating Glassmorphic Bulk Action Bar:** Positioned at the bottom viewport with live slot selection counter.
   - **Bulk Operations:** One-click bulk status transitions (Pending, In Progress, Partially Done, Done), category re-tagging, task title assignment modal, and slot clearing.
   - **Atomic Undo / Redo:** Full Ctrl+Z and Ctrl+Y integration restoring prior multi-slot state in a single action.
2. **Day Templates PostgreSQL Cloud Persistence (`/api/templates`):**
   - Migrated day templates from browser-local storage to multi-device PostgreSQL cloud storage.
   - New database table `user_day_templates` with composite primary key `(user_id, id)` and cascade deletion on user removal.
   - REST API endpoints (`GET /api/templates`, `POST /api/templates`, `PUT /api/templates/:id`, `DELETE /api/templates/:id`) with JWT user isolation.
   - Automatic first-login migration seeds existing local templates to the user's cloud account.
3. **Offline Outage Resilience (Finding 44):**
   - Added persistent per-user pending queue (`dayflow_pending_templates_<user>`) for unconfirmed template saves and deletions.
   - Guarded `syncDayTemplatesFromApi()` against overwriting local offline edits with stale cloud records; deleted templates never resurrect upon reload.
   - Idempotent delete handling (HTTP 404 treated as clean success, avoiding infinite retries).
4. **Strict 30-Minute Grid Slot Key Validation (Finding 43):**
   - Server-side slot sanitization regex enforces strict 24-hr 30-min grid alignment (`/^(?:[01]\d|2[0-3]):(?:00|30)$/`).
   - Rejects invalid hours (e.g., `25:99`, `24:00`) and non-aligned minute intervals (e.g., `09:15`, `14:45`).
5. **Grid Scroll-Jump Fix:**
   - Resolved issue where updating a slot while scrolled down jumped the viewport to the current "NOW" slot. Page-load auto-scroll behavior is preserved.
6. **Smart Duration Auto-Rule Tightening:**
   - Transitioning an in-progress slot to Done automatically sets full 30-min duration; reverting to Pending resets duration to 0m.
7. **Static Asset Cache Busting:**
   - Asset query parameter bumped to `?v=2.9.21` across `index.html` and all 10 JavaScript modules (39 references aligned).

### Database Impact & Risk Assessment:
- **Database Schema Changes:** **YES (Additive only).** Step 5 migration creates `user_day_templates` and `idx_user_day_templates_user`.
- **Downtime / Lock Impact:** **ZERO.** Creates a new table and index without modifying, locking, or restructuring existing tables (`users`, `schedule_weeks`, `schedule_slots`, `habit_logs`, `todo_items`, `password_reset_tokens`).
- **Rollback Safety:** If code is reverted to `v2.6.0`, the new table remains dormant and harmless.
- **Environment Configuration:** **NO `.env` modifications required.**
- **HelpFinder4U:** **100% ISOLATED.** DayFlow does not share PM2 processes, application directories, or database schemas with HelpFinder.

---

## 2. Pre-Deployment Tag & Repository Verification

The certified release tag `v2.7.0` has been pushed to GitHub. Deployment engineers should verify the commit boundary before proceeding:

```bash
# Verify tag remotely
git ls-remote --tags origin v2.7.0
# Expected commit: c28e3f9

# Inspect release commit summary
git log -1 --stat c28e3f9
```

---

## 3. Critical Multi-App Coexistence Safety Rules

> [!CAUTION]
> **CRITICAL PRODUCTION SAFETY RULES FOR DEPLOYMENT TEAM:**
> 1. **DO NOT restart PostgreSQL service:** Never run `sudo systemctl restart postgresql`. PostgreSQL is shared with the production **HelpFinder4U** application.
> 2. **DO NOT touch HelpFinder directories or PM2 processes:** Do not modify anything under `/var/www/helpfinder` or `/etc/nginx/sites-available/helpfinder*`.
> 3. **DO NOT run `pm2 restart all`:** Only reload the DayFlow process specifically: `pm2 reload dayflow-api --update-env`.
> 4. **DO NOT reboot the server:** A server reboot will cause downtime for all hosted applications.

---

## 4. Pre-Deployment Health Check & Baseline Recording

### Step 4.1: Connect to Server via SSH
From your local terminal with the authorized Lightsail private key:
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

### Step 4.2: Record Pre-Deployment Health & PM2 Baselines
Execute these checks to capture baseline service status and ensure HelpFinder4U is healthy:

```bash
# 1. Inspect PM2 processes and record restart counts
pm2 status

# Expected baseline:
# - hf-web       (online)
# - hf-api       (online)
# - dayflow-api  (online, port 5000, version 2.6.0)

# 2. Check Nginx web server status
sudo systemctl status nginx --no-pager

# 3. Test current live DayFlow site response
curl -I https://dayflowlive.com/api/health
# (Expected: HTTP/2 200 OK with version 2.6.0)

# 4. Confirm database connectivity
curl -s https://dayflowlive.com/api/health | grep '"database":"connected"'
```

---

## 5. Step-by-Step Deployment Procedure

### Step 5.1: Navigate to DayFlow Application Directory
```bash
cd /var/www/dayflow
```

### Step 5.2: Record Rollback Reference
```bash
git log -1 --oneline
# Expected output: 21b96d5 (tag v2.6.0)
```

---

### Step 5.3: Fetch Latest Remote Tags & Checkout `v2.7.0`
```bash
# Fetch latest tags and commits from GitHub origin
git fetch --tags origin

# Checkout the certified v2.7.0 production release tag
git checkout v2.7.0
```

Verify that the working tree is cleanly on `v2.7.0`:
```bash
git describe --tags
# Output MUST BE: v2.7.0

git status
# Output MUST SHOW: HEAD detached at v2.7.0, nothing to commit, working tree clean
```

---

### Step 5.4: Execute Database Migration (Step 5)
Run the migration script to create the `user_day_templates` table and performance index:

```bash
cd /var/www/dayflow/server

# Execute schema migration
npm run migrate
```

**Expected output:**
```text
🔄 Running DayFlow PostgreSQL schema migrations...
✅ DayFlow schema migrations and indexes completed successfully!
```

Verify table creation directly in PostgreSQL:
```bash
# Run quick verification query
sudo -u postgres psql -d dayflow_db -c "\d user_day_templates"
```
*(Confirms columns: `id`, `user_id`, `name`, `description`, `slots`, `is_default`, `created_at`, `updated_at`, and primary key `pk_user_day_templates`)*.

---

### Step 5.5: Build Server TypeScript Application
Compile the updated TypeScript source code into production JavaScript in `dist/`:

```bash
cd /var/www/dayflow/server

# Compile TypeScript
npm run build
```

Verify the build output:
```bash
# Verify exit code
echo $?
# Must output: 0

# Confirm output files exist and are recently generated
ls -la dist/server.js dist/routes/templateRoutes.js
```

---

### Step 5.6: Zero-Downtime Reload of PM2 API Service
Gracefully reload the `dayflow-api` process without dropping active HTTP connections:

```bash
# Reload ONLY dayflow-api (DO NOT USE pm2 restart all)
pm2 reload dayflow-api --update-env

# Verify process status
pm2 status dayflow-api
```

Check the startup logs to verify successful boot and version reporting:
```bash
pm2 logs dayflow-api --lines 25 --nostream
```
**Verify log lines include:**
- `DayFlow REST API Server running on port 5000 (production)`
- `Database connected`
- *(Note: Per Finding 39, the Swagger UI log line must remain omitted in production mode)*.

---

### Step 5.7: Reload Nginx Web Server
Reload Nginx to flush any cached static asset file descriptors:

```bash
# 1. Test Nginx configuration syntax
sudo nginx -t
# Must report: syntax is ok, test is successful

# 2. Gracefully reload Nginx
sudo systemctl reload nginx
```

---

## 6. Post-Deployment Verification & Smoke Tests

### 6.1 Automated Command-Line Verification
Run these checks from the server or your workstation:

```bash
# 1. Verify index.html serves v=2.9.21 cache-busting version strings
curl -s https://dayflowlive.com/index.html | grep -E "styles.css\?v=|app.js\?v="
# Expected output:
#   <link rel="stylesheet" href="src/css/styles.css?v=2.9.21">
#   <script type="module" src="src/js/app.js?v=2.9.21"></script>

# 2. Verify API Root Endpoint reports version 2.7.0 and lists templates route
curl -s https://dayflowlive.com/api/
# Expected: {"name":"DayFlow REST API Server","version":"2.7.0","status":"online",...}

# 3. Verify Health Endpoint reports version 2.7.0 and database connected
curl -s https://dayflowlive.com/api/health
# Expected: {"status":"online","database":"connected","service":"DayFlow API Server","version":"2.7.0",...}

# 4. Verify /api/templates is active and protected by JWT auth
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/templates
# Expected: 401

# 5. Verify Swagger UI remains disabled in production (Finding 39)
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/docs
# Expected: 404

# 6. Verify HelpFinder4U processes are unaffected
pm2 status hf-api
pm2 status hf-web
# (Restart counts must match the pre-deployment baseline recorded in §4.2)
```

---

### 6.2 Browser Smoke Test Checklist
Open `https://dayflowlive.com` in a browser (or incognito window):

1. **Asset Version & Badge:**
   - Hard refresh (`Ctrl+F5` / `Cmd+Shift+R`).
   - Check the top header brand badge: confirms **`v2.7.0 Web`**.
   - Network tab shows `app.js?v=2.9.21` returning HTTP 200.
2. **Multi-Slot Selection:**
   - Hold **Ctrl** (or Cmd) and click 3 non-adjacent slots: confirm selection highlight appears on all 3.
   - Click a slot, hold **Shift**, and click another slot 2 columns over and 3 rows down: confirm 2D rectangular box selection fills.
   - Verify floating **Bulk Action Bar** appears at the bottom with correct selection count.
   - Press **Escape**: confirm multi-selection clears and action bar dismisses.
3. **Bulk Actions & Undo/Redo:**
   - Select 4 slots, click bulk status **Done**: confirm all 4 slots immediately change to Done.
   - Press **Ctrl+Z**: confirm all 4 slots revert to their previous status in one atomic step.
   - Press **Ctrl+Y**: confirm redo restores the Done status.
4. **Day Templates Cloud Sync:**
   - Open **Settings** (`⚙️`) → Card 7 (**Day Templates**).
   - Create or rename a template: confirm save succeeds.
   - Open developer tools Network tab, reload page: verify `GET /api/templates` returns HTTP 200 with the saved templates from PostgreSQL.
5. **Grid Scroll-Jump Guard:**
   - Scroll down to the evening hours (e.g. 19:00).
   - Edit or click a slot: confirm the page viewport stays in place and does NOT jump to the current morning/afternoon slot.

---

## 7. Rollback Procedure (Emergency Fallback)

If any critical issue arises during deployment, execute this immediate rollback procedure. Because the database migration was purely additive (new table `user_day_templates`), rolling back to `v2.6.0` takes less than 60 seconds:

```bash
# 1. Navigate to application root
cd /var/www/dayflow

# 2. Checkout previous production release tag v2.6.0
git checkout v2.6.0

# 3. Rebuild API bundle for v2.6.0
cd /var/www/dayflow/server
npm run build

# 4. Gracefully reload PM2 process
pm2 reload dayflow-api --update-env

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Verify rollback
curl -s https://dayflowlive.com/api/health | grep '"version":"2.6.0"'
```
*(Note: There is no need to drop the `user_day_templates` table during a rollback; `v2.6.0` simply does not query it).*

---

## 8. Deployment Sign-Off Template

Upon completion, fill out this sign-off block in the deployment log:

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.7.0
================================================================================
Deployment Date:     YYYY-MM-DD
Deployed By:         [Engineer Name]
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.7.0 (commit c28e3f9)
Pre-Deploy Status:   All services healthy (HelpFinder4U & DayFlow online)
Git Checkout Tag:    v2.7.0 confirmed (git describe --tags -> v2.7.0)
DB Migration:        npm run migrate passed (user_day_templates table verified)
API Build Status:    tsc build successful (dayflow-server@2.7.0)
PM2 Reload:          dayflow-api reloaded, 0 errors, online
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.21 & app.js?v=2.9.21 confirmed live
API Health Check:    GET /api/health -> version: 2.7.0, database: connected
Templates Route:     GET /api/templates -> 401 Unauthorized (JWT protected)
Swagger Check:       /docs returns 404 in production mode
HelpFinder Health:   HelpFinder4U hf-web and hf-api verified 100% untouched
Final Status:        [ SUCCESS / ROLLED BACK ]
================================================================================
```
