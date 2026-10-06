# DayFlow v2.8.0 — Production Deployment Runbook
## Work Effectiveness Metric, Productive Task Classification, and 2-Column Settings Layout Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.7.0` (Commit `a094f6b`) |
| **Target Release Version** | **`v2.8.0`** |
| **Target Git Tag** | **`v2.8.0`** on branch `main` |
| **Deployment Type** | In-place zero-downtime upgrade (Additive DB Migration + API Rebuild + PM2 Graceful Reload + Cache Invalidation) |
| **Database Migration** | **YES (CRITICAL ORDERING: Step 5.4 MUST run before Step 5.6 API reload)** |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's New in `v2.8.0`:
1. **Work Effectiveness KPI Metric:**
   - Focus Analytics displays live Work Effectiveness percentage:
     $$\text{Work Effectiveness} = \left(\frac{\text{Productive Actual Logged Minutes}}{\text{Total Actual Logged Minutes}}\right) \times 100\%$$
   - Displays 0% when no actual time is logged (guarded against `NaN`).
2. **Category-Level Productive Defaults & High Impact Badges:**
   - User Settings allows configuring which categories count as productive (`Work` and `Learning` default to productive).
   - High Impact categories show an active "⚡ High Impact" badge in analytics.
3. **Per-Slot Productive Classification (`schedule_slots.is_productive`):**
   - Individual task override checkbox ("⚡ Mark as Productive Task") in the Task Editor modal.
   - Bulk action toggle ("⚡ Mark / Unmark Productive") in the floating multi-selection bar.
   - API upsert preserves existing stored value on omitted/non-boolean fields using `COALESCE` semantics (Finding 45 fix), preventing data loss from partial updates.
4. **Settings Page Reorganization:**
   - Reorganized into 4 balanced thematic sections:
     - Section A: Timeline & Appearance
     - Section B: Gamification, Goals & Effectiveness
     - Section C: Notifications & Sound
     - Section D: Reusable Day Templates & Cloud Sync
   - Responsive 2-column layout for wide desktop displays.
5. **Static Asset Cache Busting:**
   - Asset version parameter bumped to `?v=2.9.23` across `index.html` and all JavaScript modules (39 references aligned).

### Database Impact & Migration Ordering:
- **New Column:** `schedule_slots.is_productive BOOLEAN`
- **Migration Script:** `server/src/db/migrate.ts` executes `ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS is_productive BOOLEAN;`.
- **CRITICAL EXECUTION ORDER:** The database migration (`npm run migrate`) **MUST RUN BEFORE** rebuilding and reloading `dayflow-api`.
  - *Why:* The `v2.8.0` API queries `s.is_productive` in `GET /api/schedule/week/:weekStart`. If the API boots before the column exists, queries fail with `{"error":"column s.is_productive does not exist"}`.
  - *Risk:* Zero lock contention; `ALTER TABLE ADD COLUMN` in PostgreSQL is an instantaneous metadata-only operation without full-table rewrites.
- **Rollback Safety:** If code is reverted to `v2.7.0` or `v2.6.0`, the `is_productive` column remains safely dormant in PostgreSQL without impact.

---

## 2. Pre-Deployment Tag & Repository Verification

The certified release tag `v2.8.0` is available on GitHub:

```bash
# Verify tag commit
git rev-parse "v2.8.0^{commit}"

# Inspect release commit summary
git show v2.8.0 --stat
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
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

### Step 4.2: Record Pre-Deployment Health Baselines
```bash
# 1. Inspect PM2 processes and record restart counts
pm2 status

# Expected baseline:
# - hf-web       (online)
# - hf-api       (online)
# - dayflow-api  (online, port 5000)

# 2. Check Nginx web server status
sudo systemctl status nginx --no-pager

# 3. Test current live DayFlow site response
curl -I https://dayflowlive.com/api/health
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
# Expected output: a094f6b (tag v2.7.0)
```

---

### Step 5.3: Fetch Latest Remote Tags & Checkout `v2.8.0`
```bash
# Fetch latest tags and commits from GitHub origin
git fetch --tags origin

# Option A (Standard): Checkout the certified v2.8.0 production release tag
git checkout v2.8.0

# Option B (Immutable Commit): Alternatively checkout the verified commit hash directly
# git checkout $(git rev-parse "v2.8.0^{commit}")
```

Verify that the working tree is cleanly on `v2.8.0`:
```bash
git describe --tags
# Output MUST BE: v2.8.0

git status
# Output MUST SHOW: HEAD detached at v2.8.0, nothing to commit, working tree clean
```

---

### Step 5.4: Execute Database Migration (MUST RUN BEFORE API RELOAD)
Run the migration script to ensure the `schedule_slots.is_productive` column exists:

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

Verify column creation directly in PostgreSQL:
```bash
sudo -u postgres psql -d dayflow_db -c "\d schedule_slots"
```
*(Verify that `is_productive | boolean` appears in the table column list).*

---

### Step 5.5: Build Server TypeScript Application
Compile the updated TypeScript source code into production JavaScript in `dist/`:

```bash
cd /var/www/dayflow/server

# Compile TypeScript
npm run build
```

Verify build success:
```bash
echo $?
# Must output: 0

ls -la dist/server.js dist/routes/scheduleRoutes.js
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

Check startup logs:
```bash
pm2 logs dayflow-api --lines 25 --nostream
```
**Verify log lines include:**
- `DayFlow REST API Server running on port 5000 (production)`
- `Database connected`

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
```bash
# 1. Verify index.html serves v=2.9.23 cache-busting version strings
curl -s https://dayflowlive.com/index.html | grep -E "styles.css\?v=|app.js\?v="
# Expected output:
#   <link rel="stylesheet" href="src/css/styles.css?v=2.9.23">
#   <script type="module" src="src/js/app.js?v=2.9.23"></script>

# 2. Verify API Root Endpoint reports version 2.8.0
curl -s https://dayflowlive.com/api/
# Expected: {"name":"DayFlow REST API Server","version":"2.8.0","status":"online",...}

# 3. Verify Health Endpoint reports version 2.8.0 and database connected
curl -s https://dayflowlive.com/api/health
# Expected: {"status":"online","database":"connected","service":"DayFlow API Server","version":"2.8.0",...}

# 4. Verify /api/templates is active and protected by JWT auth
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/templates
# Expected: 401

# 5. Verify Swagger UI remains disabled in production (Finding 39)
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/docs
# Expected: 404

# 6. Verify HelpFinder4U processes are unaffected
pm2 status hf-api
pm2 status hf-web
```

---

### 6.2 Browser Smoke Test Checklist
Open `https://dayflowlive.com` in a browser:

1. **Asset Version & Badge:**
   - Hard refresh (`Ctrl+F5` / `Cmd+Shift+R`).
   - Header badge confirms **`v2.8.0 Web`**.
   - Network tab shows `app.js?v=2.9.23` returning HTTP 200.
2. **Work Effectiveness KPI:**
   - Open Focus Analytics view.
   - Verify **Work Effectiveness** card displays percentage (e.g. `0%` or active percentage, not `NaN`).
3. **Productive Task Override in Modal:**
   - Open any schedule slot modal: confirm "⚡ Mark as Productive Task" checkbox is visible.
   - Toggle checkbox and save: reload and confirm custom choice persists.
4. **Settings 2-Column Layout:**
   - Open Settings (`⚙️`).
   - Confirm layout displays 4 organized sections arranged in 2 balanced columns on desktop.
   - Verify Category Productive Classification pills function and persist.

---

## 7. Rollback Procedure (Emergency Fallback)

If any critical issue arises during deployment, execute this immediate rollback procedure:

```bash
# 1. Navigate to application root
cd /var/www/dayflow

# 2. Checkout previous production release tag v2.7.0
git checkout v2.7.0

# 3. Rebuild API bundle for v2.7.0
cd /var/www/dayflow/server
npm run build

# 4. Gracefully reload PM2 process
pm2 reload dayflow-api --update-env

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Verify rollback
curl -s https://dayflowlive.com/api/health | grep '"version":"2.7.0"'
```

> [!NOTE]
> **Database Rollback Safety:**
> The `schedule_slots.is_productive` column is purely additive. If code is rolled back to `v2.7.0` (or `v2.6.0`), the column remains in PostgreSQL safely dormant. Previous versions ignore the column completely without throwing errors.

---

## 8. Deployment Sign-Off Template

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.8.0
================================================================================
Deployment Date:     YYYY-MM-DD
Deployed By:         [Engineer Name]
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.8.0
Pre-Deploy Status:   All services healthy (HelpFinder4U & DayFlow online)
Git Checkout Tag:    v2.8.0 confirmed (git describe --tags -> v2.8.0)
Commit SHA:          Confirmed via git rev-parse "v2.8.0^{commit}"
DB Migration:        npm run migrate passed (schedule_slots.is_productive verified)
API Build Status:    tsc build successful (dayflow-server@2.8.0)
PM2 Reload:          dayflow-api reloaded, 0 errors, online
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.23 & app.js?v=2.9.23 confirmed live
API Health Check:    GET /api/health -> version: 2.8.0, database: connected
Templates Route:     GET /api/templates -> 401 Unauthorized (JWT protected)
Swagger Check:       /docs returns 404 in production mode
HelpFinder Health:   HelpFinder4U hf-web and hf-api verified 100% untouched
Final Status:        [ SUCCESS / ROLLED BACK ]
================================================================================
```
