# DayFlow v2.9.0 — Production Deployment Runbook
## Custom Task Categories, Security Hardening, and Notification Quiet Hours Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.8.0` (Commit `7b4dd01`) |
| **Target Release Version** | **`v2.9.0`** |
| **Target Git Tag & Commit** | **`v2.9.0`** on branch `main` |
| **Deployment Type** | In-place zero-downtime upgrade (Additive DB Migration + API Rebuild + PM2 Graceful Reload + Nginx Cache Invalidation) |
| **Database Migration** | **YES (CRITICAL ORDERING: Step 5.4 MUST run before Step 5.6 API reload)** |
| **QA Verification Status** | ✅ **PASSED & CERTIFIED (2026-10-10)** — 316 checks passing (176 API + 140 E2E), 14/14 prod-mode tests |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's New in `v2.9.0`:
1. **Custom Task Categories Engine (`user_categories` table):**
   - User-defined category management in Settings: create, rename/edit, custom emoji icon, custom color picker, productive toggle, archive, and restore.
   - Dedicated REST API endpoints:
     - `GET /api/categories` — list all categories for the authenticated user (supports `?includeArchived=true`).
     - `POST /api/categories` — create a new custom category.
     - `PUT /api/categories/:id` — update category attributes.
     - `DELETE /api/categories/:id` — delete custom category (or archive if referenced by existing schedule slots).
   - System default category protection: System default "General" category cannot be deleted or archived via `DELETE` or `PUT` (Finding 47 security hardening).
   - Unconditional UUID validation on category IDs across all runtime environments.
   - Cascade category renames across active schedules locally and in cloud storage.
   - User isolation and instant UI restoration without requiring a page refresh.
   - Outage resilience via client pending-save queue (`dayflow_pending_categories_<userId>`): changes made during network outages survive reloads and cleanly sync upon reconnection (Finding 46).
2. **Notification Active Hours & Quiet Window (Do Not Disturb):**
   - Active Notification Window: configurable wakeup and sleep hours (e.g. 08:00 AM – 10:00 PM) to silence alerts at night.
   - Overnight active window support (e.g. 10:00 PM to 06:00 AM for night schedules).
   - 1-Click Quick Presets: Standard Day (8 AM – 10 PM), Work Hours (9 AM – 6 PM), Extended (7 AM – 11 PM), and 24/7 Always Active.
   - Quiet Hours Behavior modes: Full Silence (mutes audio chimes and blocks desktop/toast popups) vs. Sound Muted Only (mutes chimes, permits silent toasts).
   - Weekend Silence mode: automatically suppresses all alerts on Saturday and Sunday.
   - Productive-Only task filter: restricts reminders to high-impact/productive blocks (⚡), suppressing alerts for meals, chores, or leisure.
   - Dynamic header notification bell indicator: displays a moon icon (`🌙`) with detailed tooltip during active quiet hours or weekend mute.
3. **UI, Accessibility & Standards:**
   - Standard CSS `appearance: textfield;` on inline duration number inputs.
   - Header badge updated to `v2.9.0 Web`.
   - Static asset cache-busting parameter updated to `?v=2.9.29` across all 43 script and style references.

### Database Impact & Migration Ordering:
- **New Table:** `user_categories` (PostgreSQL UUID primary key, `user_id` foreign key, `name`, `icon`, `color`, `is_productive`, `is_system`, `is_archived`, `sort_order`, `UNIQUE(user_id, name)`).
- **Auto-Seeding:** Idempotently seeds the 7 default categories (`Work`, `Learning`, `Health`, `Household`, `Family`, `Travel`, `General`) for all existing users in the `users` table upon migration.
- **Migration Script:** `server/src/db/migrate.ts` executes `CREATE TABLE IF NOT EXISTS user_categories (...)` and seeds default records (`ON CONFLICT DO NOTHING`).
- **CRITICAL EXECUTION ORDER:** The database migration (`npm run migrate`) **MUST RUN BEFORE** rebuilding and reloading `dayflow-api`.
  - *Why:* The `v2.9.0` API mounts `/api/categories` and accesses `user_categories`. If the API boots before the table exists, category queries fail.
  - *Risk:* Millisecond-level table creation; completely additive with zero table locks on existing tables.
- **Rollback Safety:** If code is reverted to `v2.8.0`, the `user_categories` table remains safely dormant in PostgreSQL without impact.

---

## 2. Pre-Deployment Tag & Repository Verification

The certified release tag `v2.9.0` resolves on GitHub:

```bash
# Verify tag resolves to expected certified commit
git rev-parse "v2.9.0^{commit}"

# Inspect release commit summary
git show v2.9.0 --stat
```

### QA Retest Verification Certificate:
- **Test Date:** 2026-10-10
- **Regression Suite:** 316 checks passing (176 API + 140 E2E tests) across two consecutive runs, 0 retries.
- **Production Mode:** 14/14 tests passed under `NODE_ENV=production`.
- **Security & Schema Checks:** 0 npm audit vulnerabilities, clean schema and API contract checks.
- **Verdict:** Certified production-ready for promotion.

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
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

### Step 4.2: Record Pre-Deployment Health Baselines
```bash
# 1. Inspect PM2 processes and record restart counts
pm2 status

# Expected output shows:
# dayflow-api    online    port 5000
# hf-api         online    port 5001
# hf-web         online    port 3000

# 2. Check Nginx web server status
sudo systemctl status nginx --no-pager

# 3. Check current live production API health (v2.8.0)
curl -s https://dayflowlive.com/api/health | jq .
# Expected: {"status":"online","database":"connected","version":"2.8.0",...}
```

---

## 5. Step-by-Step Production Deployment Procedure

### Quick-Reference Execution Sequence Checklist
For fast operational reference during deployment, follow this sequence:

| # | Step | Exact Command | Expected Output / Check | Logged Status |
|---|---|---|---|:---:|
| **1** | Database Snapshot | `pg_dump -Fc -d dayflow_db > ~/backups/dayflow_db_pre_v2.9.0_$(date +%Y%m%d_%H%M).dump` | Valid dump created | `[ ]` |
| **2** | Record Rollback Pin | `cd /var/www/dayflow && git log -1 --oneline` | `7b4dd01` (tag `v2.8.0`) | `[ ]` |
| **3** | Fetch Tags | `git fetch --tags origin` | Latest tags fetched | `[ ]` |
| **4** | Checkout Release | `git checkout v2.9.0` | `HEAD detached at v2.9.0` | `[ ]` |
| **5** | Verify Clean Tree | `git status` | `nothing to commit, working tree clean` | `[ ]` |
| **6** | Host Node Runtime Check | `node --version` | `v22.x.x` (upgrade via nvm if older) | `[ ]` |
| **7** | **Execute DB Migration**<br>*(MUST precede API reload)* | `cd /var/www/dayflow/server && npm run migrate` | `✅ DayFlow schema migrations and indexes completed successfully!` | `[ ]` |
| **8** | Verify Table in DB | `sudo -u postgres psql -d dayflow_db -c "\d user_categories"` | Columns present, rows seeded | `[ ]` |
| **9** | Rebuild Server TypeScript | `npm run build` | Zero errors (`echo $?` -> `0`), `dist/server.js` generated | `[ ]` |
| **10** | Graceful PM2 Reload | `pm2 reload dayflow-api --update-env` | Status `online`, restart count increments by 1 | `[ ]` |
| **11** | Verify API Boot Logs | `pm2 logs dayflow-api --lines 25 --nostream` | `DayFlow REST API Server running on port 5000 (production)`, `Database connected` | `[ ]` |
| **12** | Test Nginx Syntax | `sudo nginx -t` | `syntax is ok, test is successful` | `[ ]` |
| **13** | Reload Nginx | `sudo systemctl reload nginx` | Clean reload, active | `[ ]` |

---

### Step 5.1: Database Pre-Upgrade Backup (MANDATORY)
Perform a full snapshot backup of PostgreSQL before touching application code:
```bash
mkdir -p ~/backups
pg_dump -Fc -d dayflow_db > ~/backups/dayflow_db_pre_v2.9.0_$(date +%Y%m%d_%H%M).dump

# Verify backup integrity (must show valid TOC without errors)
pg_restore --list ~/backups/dayflow_db_pre_v2.9.0_*.dump | head -n 5
```

### Step 5.2: Record Rollback Baseline Commit
```bash
cd /var/www/dayflow
git log -1 --oneline
# Record this commit hash and tag (should be v2.8.0) as the rollback target.
```

### Step 5.3: Fetch Latest Remote Tags & Checkout `v2.9.0`
```bash
cd /var/www/dayflow

# Fetch latest tags and commits from origin
git fetch --tags origin

# Checkout the certified v2.9.0 production release tag
git checkout v2.9.0

# Verify checkout status
git describe --tags
# Output MUST BE: v2.9.0

git status
# Output MUST SHOW: HEAD detached at v2.9.0, nothing to commit, working tree clean
```

### Step 5.3.1: Host Node.js Runtime Version Check
DayFlow `v2.9.0` requires Node.js 22.x LTS on the host:
```bash
node --version
# Expected: v22.x.x

# IF host reports v20.x or older:
# nvm install 22
# nvm use 22
# nvm alias default 22
```

### Step 5.4: Execute Database Schema Migration (CRITICAL STEP)
> [!IMPORTANT]
> This step **MUST RUN BEFORE** restarting `dayflow-api`. It creates the `user_categories` table and populates default categories for all existing users.

```bash
cd /var/www/dayflow/server

# Execute additive migration script
npm run migrate

# Expected Output:
# 🔄 Running DayFlow PostgreSQL schema migrations...
# ✅ DayFlow schema migrations and indexes completed successfully!
```

### Step 5.4.1: Verify `user_categories` Table in PostgreSQL
```bash
# Check table definition in PostgreSQL
sudo -u postgres psql -d dayflow_db -c "\d user_categories"
# Verify user_categories table columns: id, user_id, name, icon, color, is_productive, is_system, is_archived, sort_order

# Check that categories were seeded
sudo -u postgres psql -d dayflow_db -c "SELECT count(*) FROM user_categories;"
# Should show > 0 seeded rows
```

### Step 5.5: Build Server TypeScript Bundle
```bash
cd /var/www/dayflow/server

# Install dependencies cleanly
npm ci --omit=dev

# Compile TypeScript to dist/
npm run build

# Verify build succeeded with exit code 0
echo $?
# Output MUST BE: 0

# Confirm dist/server.js was compiled
ls -l dist/server.js
```

### Step 5.6: Zero-Downtime PM2 API Graceful Reload
```bash
# Gracefully reload dayflow-api with updated environment
pm2 reload dayflow-api --update-env

# Verify PM2 status shows online and memory is stable
pm2 status

# Inspect recent logs to verify clean boot
pm2 logs dayflow-api --lines 25 --nostream
# Expected log lines:
# DayFlow REST API Server running on port 5000 (production)
# PostgreSQL connection pool established
```

### Step 5.7: Verify Nginx Web Proxy & Reload
```bash
# Test Nginx configuration syntax
sudo nginx -t
# Output MUST BE: syntax is ok, test is successful

# Reload Nginx to serve the new static assets and flush gzip/proxy buffers
sudo systemctl reload nginx
```

---

## 6. Post-Deployment Verification & Smoke Tests

Execute these validation commands immediately from the server and external browser:

### Smoke Test 1: Verify API Root & Version
```bash
curl -s https://dayflowlive.com/api/ | jq .
# Expected output:
# {
#   "name": "DayFlow REST API Server",
#   "version": "2.9.0",
#   "status": "online",
#   "docs": "https://dayflowlive.com/api-docs (disabled in production)"
# }
```

### Smoke Test 2: Verify Health Endpoint
```bash
curl -s https://dayflowlive.com/api/health | jq .
# Expected output:
# {
#   "status": "online",
#   "database": "connected",
#   "service": "DayFlow API Server",
#   "version": "2.9.0",
#   "uptime": ...,
#   "timestamp": "..."
# }
```

### Smoke Test 3: Categories Endpoint & Security Hardening
```bash
# 1. Unauthenticated request to /api/categories must return 401
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/categories
# Expected: 401

# 2. Malformed UUID request to /api/categories/:id must return 400
curl -s -X DELETE https://dayflowlive.com/api/categories/not-a-uuid \
  -H "Authorization: Bearer test" | jq .
# Expected: {"error": "Invalid UUID format for category id"} (HTTP 400)
```

### Smoke Test 4: Frontend Web Assets & Cache-Busting Verification
```bash
# Verify static HTML serves v2.9.0 badge and v=2.9.29 asset query parameter
curl -s https://dayflowlive.com/ | grep -E 'v2.9.0 Web|v=2.9.29'
# Expected matches:
# <span class="badge">v2.9.0 Web</span>
# <link rel="stylesheet" href="src/css/styles.css?v=2.9.29">
# <script type="module" src="src/js/app.js?v=2.9.29"></script>
```

### Smoke Test 5: End-to-End Browser Verification
Open `https://dayflowlive.com` in a browser:
1. **Header Badge:** Displays **`v2.9.0 Web`**.
2. **Settings -> Task Categories Management:**
   - Active categories list displays with icons and color pills.
   - Click "+ Add Category": creates category with instant UI reflection.
   - Archive and restore category: updates active list immediately without refresh.
   - Attempting to delete "General" displays protection message: *"Cannot delete the system default category 'General'"*.
3. **Settings -> Notifications & Audio Alarms:**
   - "Active Hours & Quiet Window (Do Not Disturb)" controls are visible.
   - Quick preset buttons (`☀️ Standard Day`, `💼 Work Hours`, `🦉 Extended`, `⏰ 24/7`) update hours and summary text dynamically.
   - Weekend Silence toggle and Productive-Only Tasks toggle save and persist across reloads.
4. **Header Notification Bell:**
   - Shows normal bell (`🔔` / `🔕`) during active hours; displays moon indicator (`🌙`) with tooltip during quiet hours.

---

## 7. Coexisting Application Health Check (HelpFinder4U)

Confirm that HelpFinder4U was completely unaffected:
```bash
# 1. Inspect HelpFinder PM2 processes (restart counts must NOT have increased)
pm2 status

# 2. Query HelpFinder API endpoint
curl -s -I http://127.0.0.1:5001/api/health | head -n 3
# Expected: HTTP/1.1 200 OK

# 3. Query HelpFinder Web frontend
curl -s -I http://127.0.0.1:3000/ | head -n 3
# Expected: HTTP/1.1 200 OK
```

---

## 8. Rollback Runbook (Zero-Downtime Reversion)

If a critical issue is discovered post-deployment, execute this rollback procedure to revert to `v2.8.0`:

```bash
cd /var/www/dayflow

# 1. Checkout v2.8.0 tag
git checkout v2.8.0

# 2. Rebuild v2.8.0 server bundle
cd /var/www/dayflow/server
npm ci --omit=dev
npm run build

# 3. Reload PM2 process
pm2 reload dayflow-api --update-env

# 4. Reload Nginx
sudo systemctl reload nginx

# 5. Verify rollback health
curl -s https://dayflowlive.com/api/health | jq .
# Expected: version: "2.8.0", database: "connected"
```
*(Note: Database rollback is NOT required. The additive `user_categories` table remains safely dormant in PostgreSQL without impacting `v2.8.0`.)*

---

## 9. Post-Execution Log & Production Sign-Off Certificate

This section is to be completed by the deployment engineer directly upon concluding deployment execution:

### Live Verification Checklist
- [ ] **API Root Endpoint:** `curl -s https://dayflowlive.com/api/` reports `"version":"2.9.0"` and `"status":"online"`.
- [ ] **API Health Endpoint:** `curl -s https://dayflowlive.com/api/health` reports `"version":"2.9.0"` and `"database":"connected"`.
- [ ] **Categories API:** Unauthenticated requests to `/api/categories` return 401; UUID format validation active.
- [ ] **Frontend Web Assets:** Header badge displays `v2.9.0 Web`; assets reference `v=2.9.29`.
- [ ] **Settings UI:** Custom Task Categories and Quiet Hours controls load and function cleanly.
- [ ] **HelpFinder4U Coexistence:** `hf-web` and `hf-api` remain online; restart counts unchanged.

### Execution Log & Sign-Off Record

```
========================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.9.0
========================================================================
Deployment Date:     ____________________ (YYYY-MM-DD)
Deployment Time:     ________ to ________ (UTC / Local)
Deployment Engineer: ____________________
Target Release Tag:  v2.9.0
Git Checkout Tag:    v2.9.0 confirmed (git describe --tags -> v2.9.0)
Commit SHA:          Confirmed via git rev-parse "v2.9.0^{commit}"
Database Migration:  npm run migrate -> user_categories table verified
API Build Status:    tsc build successful (dayflow-server@2.9.0)
PM2 Process Status:  dayflow-api online, 0 unexpected restarts
API Health Check:    GET /api/health -> version: 2.9.0, database: connected
Web Asset Check:     HTML header badge v2.9.0 Web, cache-buster ?v=2.9.29
HelpFinder Coexist:  hf-web & hf-api verified online and untouched
========================================================================
DEPLOYMENT RESULT:   [  ] SUCCESSFUL ROLLOUT    [  ] ROLLBACK TRIGGERED
SIGN-OFF VERDICT:    [  ] APPROVED & CERTIFIED IN PRODUCTION
========================================================================
Engineer Notes:
________________________________________________________________________
________________________________________________________________________
========================================================================
```
