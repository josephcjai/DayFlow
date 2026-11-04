# DayFlow v2.10.0 — Production Deployment Runbook
## Self-Service Account Deletion, Server Admin CLI, Legal Compliance Pages, and Security Hardening Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.8.0` / `v2.9.0` |
| **Target Release Version** | **`v2.10.0`** |
| **Target Git Tag & Commit** | **`v2.10.0`** on branch `main` |
| **Deployment Type** | In-place zero-downtime upgrade (Additive DB Migration + API Rebuild + PM2 Graceful Reload + Nginx Cache Invalidation) |
| **Database Migration** | **YES (CRITICAL ORDERING: Step 5.4 MUST run before Step 5.6 API reload)** |
| **QA Verification Status** | ✅ **PASSED & CERTIFIED (2026-11-03)** — 336 checks passing (188 API + 148 E2E), 14/14 prod-mode tests |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's New in `v2.10.0`:
1. **Self-Service Account Deletion & Right to Erasure (`DELETE /api/auth/account` & `/api/auth/me`):**
   - Full compliance with Google Play Store Data Safety and GDPR/CCPA self-service erasure mandates.
   - Supports credential verification for standard password accounts (`password` required) and explicit confirmation (`"DELETE"` or user email) for Google OAuth-only accounts.
   - Executes a single transactional `DELETE FROM users WHERE id = $1` that cascades (`ON DELETE CASCADE`) across all child tables (`schedule_weeks`, `schedule_slots`, `habit_logs`, `todo_items`, `user_day_templates`, `user_categories`, and `password_reset_tokens`), permanently eradicating all user records.
   - Client-side `purgeAllUserData()` wipes all user-scoped `localStorage` keys and session state upon confirmed deletion.
2. **Phase 1 Zero-Attack-Surface Server Admin CLI (`npm run admin -- <command>`):**
   - Privacy-first CLI utility (`server/src/admin/cli.ts` -> `dist/admin/cli.js`) accessible strictly via SSH on the host server with **zero public HTTP routes**.
   - Supported commands:
     - `stats` — aggregate user counts (total, active, suspended, Google-linked) and table row totals without exposing private task/note text.
     - `users [limit]` — list recent user accounts with status and creation date.
     - `user <email>` — inspect account metadata and activity row counts for a specific user.
     - `disable <email>` — suspend a user account (`is_disabled = true`) and increment `token_version` to immediately revoke active JWT sessions.
     - `enable <email>` — reactivate a suspended user account (`is_disabled = false`).
     - `reset-password <email> <newPassword>` — force-reset a user's password and invalidate prior tokens.
     - `delete-user <email> [--confirm]` — dry-run preview without `--confirm`; permanent cascading deletion with `--confirm`.
   - **Security & Data Hardening:**
     - **Finding 48 Fix:** Reversible account suspension clears session credentials and in-memory state while preserving local offline pending queues (`dayflow_pending_categories_<userId>`, `dayflow_pending_slots_<userId>`) so uncommitted offline work survives reactivation.
     - **Finding 49 Fix:** `/api/auth/login` evaluates `is_disabled` only *after* unconditional constant-time `bcrypt.compare` verification (~65–95ms), preventing timing-based enumeration of suspended accounts.
3. **Standalone Legal Compliance Pages & In-App Modal (`about.html`, `terms.html`, `privacy.html`):**
   - Canonical standalone pages at `/about.html`, `/terms.html`, and `/privacy.html` served directly from the web root for Google Play Store listing compliance and statutory disclosure.
   - Unified instant client-side tab switching (`history.replaceState`) across all three standalone pages with flicker-free navigation back to the application.
   - In-app executive summary modal accessible from the login screen footer and Settings.
4. **Schedule Grid "NOW" Cell Auto-Centering & UI Polish:**
   - Resilient `scrollToCurrentSlot()` dynamically queries the live DOM (`.slot-cell.current-active-slot`), retries via `requestAnimationFrame` if layout dimensions are mid-transition, debounces startup sync re-renders, and sets `history.scrollRestoration = 'manual'` so both login and page reload reliably center on the current time slot.
   - Header badge updated to `v2.10.0 Web`; static asset cache-busting parameter updated to `?v=2.10.3`.
5. **Cumulative `v2.9.0` Features (Included if upgrading directly from `v2.8.0`):**
   - Custom Task Categories engine (`user_categories` table & `/api/categories` CRUD endpoints) and Notification Active Hours & Quiet Window (Do Not Disturb).

### Database Impact & Migration Ordering:
- **New Column on `users`:** `is_disabled BOOLEAN NOT NULL DEFAULT false` (`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;`).
- **Cumulative Table (`v2.9.0`):** `user_categories` table creation and idempotent default category seeding (`ON CONFLICT DO NOTHING`) if not yet applied.
- **Schema Parity:** `server/src/db/schema.sql` and `server/src/db/migrate.ts` are 100% synchronized (Finding 50).
- **CRITICAL EXECUTION ORDER:** The database migration (`npm run migrate`) **MUST RUN BEFORE** rebuilding and reloading `dayflow-api`.
  - *Why:* `authMiddleware.ts` executes `SELECT token_version, is_disabled FROM users WHERE id = $1` on every authenticated API request. If `dayflow-api` reloads before `users.is_disabled` exists in PostgreSQL, authenticated requests will fail with a missing column error.
  - *Risk:* Millisecond-level metadata-only `ADD COLUMN IF NOT EXISTS ... DEFAULT false` in PostgreSQL 16; zero table rewrite and zero downtime.
- **Rollback Safety:** If code is reverted to `v2.9.0` or `v2.8.0`, the `is_disabled` column (defaulting to `false`) and `user_categories` table remain safely dormant in PostgreSQL without any impact on older code.

---

## 2. Pre-Deployment Tag & Repository Verification

Verify that the certified release tag `v2.10.0` resolves cleanly on GitHub:

```bash
# Verify tag resolves to expected certified commit
git rev-parse "v2.10.0^{commit}"

# Inspect release commit summary
git show v2.10.0 --stat
```

### QA Retest Verification Certificate:
- **Test Date:** 2026-11-03
- **Regression Suite:** 336 checks passing (188 API across 5 batches + 148 E2E across 13 batches).
- **Production Mode:** 14/14 tests passed under `NODE_ENV=production` (including live timing verification of Finding 49).
- **Schema & Contract Guards:** `schema:check` and `contract:check` both clean.
- **Verdict:** Certified production-ready for promotion.

---

## 3. Critical Multi-App Coexistence Safety Rules

> [!CAUTION]
> **CRITICAL PRODUCTION SAFETY RULES FOR DEPLOYMENT TEAM:**
> 1. **DO NOT restart PostgreSQL service:** Never run `sudo systemctl restart postgresql`. PostgreSQL is shared with the production **HelpFinder4U** application.
> 2. **DO NOT touch HelpFinder directories or PM2 processes:** Do not modify anything under `/var/www/helpfinder` or `/etc/nginx/sites-available/helpfinder*`.
> 3. **DO NOT run `pm2 restart all`:** Only reload the DayFlow process specifically: `pm2 reload dayflow-api --update-env`.
> 4. **DO NOT change the host default Node version (`nvm alias default`):** Keep the host on Node.js 20 LTS (`v2.10.0` is built and certified for Node 20 LTS).
> 5. **DO NOT reboot the server:** A server reboot will cause downtime for all hosted applications.

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

# 3. Check current live production API health
curl -s https://dayflowlive.com/api/health | jq .
# Expected: {"status":"online","database":"connected",...}
```

---

## 5. Step-by-Step Production Deployment Procedure

### Quick-Reference Execution Sequence Checklist
For fast operational reference during deployment, follow this exact sequence:

| # | Step | Exact Command | Expected Output / Check | Logged Status |
|---|---|---|---|:---:|
| **1** | Database Snapshot | `pg_dump -Fc -d dayflow_db > ~/backups/dayflow_db_pre_v2.10.0_$(date +%Y%m%d_%H%M).dump` | Valid dump created | `[ ]` |
| **2** | Record Rollback Pin | `cd /var/www/dayflow && git log -1 --oneline` | Record current commit hash & tag | `[ ]` |
| **3** | Fetch Tags | `git fetch --tags origin` | Latest tags fetched (`v2.10.0`) | `[ ]` |
| **4** | Checkout Release | `git checkout v2.10.0` | `HEAD detached at v2.10.0` | `[ ]` |
| **5** | Verify Clean Tree | `git status` | `nothing to commit, working tree clean` | `[ ]` |
| **6** | Host Node Runtime Check | `node --version` | `v20.x.x` LTS (DO NOT change NVM default) | `[ ]` |
| **7** | **Execute DB Migration**<br>*(MUST precede API reload)* | `cd /var/www/dayflow/server && npm run migrate` | `✅ DayFlow schema migrations and indexes completed successfully!` | `[ ]` |
| **8** | Verify Schema in DB | `sudo -u postgres psql -d dayflow_db -c "\d users"` | `is_disabled \| boolean \| not null \| false` present | `[ ]` |
| **9** | Install & Build Server | `npm ci --omit=dev && npm run build` | Zero errors (`echo $?` -> `0`), `dist/server.js` & `dist/admin/cli.js` generated | `[ ]` |
| **10** | Graceful PM2 Reload | `pm2 reload dayflow-api --update-env` | Status `online`, restart count increments by 1 | `[ ]` |
| **11** | Verify API Boot Logs | `pm2 logs dayflow-api --lines 25 --nostream` | `DayFlow REST API Server running on port 5000 (production)`, `Database connected` | `[ ]` |
| **12** | Test Admin CLI | `npm run admin -- stats` | Prints total/active/suspended user counts & table metrics | `[ ]` |
| **13** | Test & Reload Nginx | `sudo nginx -t && sudo systemctl reload nginx` | `syntax is ok, test is successful`, clean reload | `[ ]` |

---

### Step 5.1: Database Pre-Upgrade Backup (MANDATORY)
Perform a full snapshot backup of PostgreSQL before touching application code:
```bash
mkdir -p ~/backups
pg_dump -Fc -d dayflow_db > ~/backups/dayflow_db_pre_v2.10.0_$(date +%Y%m%d_%H%M).dump

# Verify backup integrity (must show valid TOC without errors)
pg_restore --list ~/backups/dayflow_db_pre_v2.10.0_*.dump | head -n 5
```

### Step 5.2: Record Rollback Baseline Commit
```bash
cd /var/www/dayflow
git log -1 --oneline
# Record this commit hash and tag (e.g. v2.8.0 or v2.9.0) as the rollback target.
```

### Step 5.3: Fetch Latest Remote Tags & Checkout `v2.10.0`
```bash
cd /var/www/dayflow

# Fetch latest tags and commits from origin
git fetch --tags origin

# Checkout the certified v2.10.0 production release tag
git checkout v2.10.0

# Verify checkout status
git describe --tags
# Output MUST BE: v2.10.0

git status
# Output MUST SHOW: HEAD detached at v2.10.0, nothing to commit, working tree clean
```

### Step 5.3.1: Host Node.js Runtime Verification
Verify the server Node.js runtime:
```bash
node --version
# Expected: v20.x.x (Lightsail production runtime is Node 20 LTS)
```

> [!NOTE]
> **Do NOT run `nvm alias default` or upgrade Node on the host.** DayFlow `v2.10.0` is configured for Node.js 20 LTS (`"engines": { "node": ">=20.0.0" }`). Note that `google-auth-library` may print an advisory `EBADENGINE` notice during `npm ci`, which is completely benign at runtime and verified across all Google OAuth tests on Node 20.

### Step 5.4: Execute Database Schema Migration (CRITICAL STEP)
> [!IMPORTANT]
> This step **MUST RUN BEFORE** restarting `dayflow-api`. It adds `users.is_disabled` (and ensures `user_categories` exists and is seeded).

```bash
cd /var/www/dayflow/server

# Execute additive migration script
npm run migrate

# Expected Output:
# 🔄 Running DayFlow PostgreSQL schema migrations...
# ✅ DayFlow schema migrations and indexes completed successfully!
```

### Step 5.4.1: Verify `users.is_disabled` Column & `user_categories` Table in PostgreSQL
```bash
# 1. Verify is_disabled column exists on users table
sudo -u postgres psql -d dayflow_db -c "\d users"
# Confirm column: is_disabled | boolean | not null | false

# 2. Verify user_categories table and seeded rows
sudo -u postgres psql -d dayflow_db -c "SELECT count(*) FROM user_categories;"
# Should show > 0 seeded rows
```

### Step 5.5: Build Server TypeScript Bundle (API + Admin CLI)
```bash
cd /var/www/dayflow/server

# Install dependencies cleanly
npm ci --omit=dev

# Compile TypeScript to dist/
npm run build

# Verify build succeeded with exit code 0
echo $?
# Output MUST BE: 0

# Confirm both dist/server.js and dist/admin/cli.js were compiled
ls -l dist/server.js dist/admin/cli.js
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
Because `about.html`, `terms.html`, and `privacy.html` reside at `/var/www/dayflow/` alongside `index.html`, Nginx's existing `root /var/www/dayflow;` serves them automatically:
```bash
# Verify standalone legal pages are present in the web root
ls -l /var/www/dayflow/about.html /var/www/dayflow/terms.html /var/www/dayflow/privacy.html

# Test Nginx configuration syntax
sudo nginx -t
# Output MUST BE: syntax is ok, test is successful

# Reload Nginx to serve the new static assets and flush gzip/proxy buffers
sudo systemctl reload nginx
```

---

## 6. Post-Deployment Verification & Smoke Tests

Execute these validation commands immediately from the server and external browser:

### Smoke Test 1: Verify API Root & Version (`2.10.0`)
```bash
curl -s https://dayflowlive.com/api/ | jq .
# Expected output:
# {
#   "name": "DayFlow REST API Server",
#   "version": "2.10.0",
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
#   "version": "2.10.0",
#   "uptime": ...,
#   "timestamp": "..."
# }
```

### Smoke Test 3: Verify Account Deletion & Categories Auth Guards
```bash
# 1. Unauthenticated DELETE /api/auth/account must return 401
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE https://dayflowlive.com/api/auth/account
# Expected: 401

# 2. Unauthenticated DELETE /api/auth/me alias must return 401
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE https://dayflowlive.com/api/auth/me
# Expected: 401

# 3. Unauthenticated GET /api/categories must return 401
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/categories
# Expected: 401
```

### Smoke Test 4: Verify Server-Side Admin CLI (`npm run admin`)
```bash
cd /var/www/dayflow/server
npm run admin -- stats
# Expected output:
# 📊 DAYFLOW SYSTEM STATISTICS
# Total Registered Users: ... (Active: ..., Suspended: ...)
# Total Schedule Weeks:   ...
# Total Schedule Slots:   ...
# Total Habit Logs:       ...
# Total Todo Items:       ...
```

### Smoke Test 5: Verify Standalone Legal Pages & Cache-Busting (`?v=2.10.3`)
```bash
# 1. Verify index.html serves v2.10.0 Web badge and v=2.10.3 asset query parameter
curl -s https://dayflowlive.com/ | grep -E 'v2.10.0 Web|v=2.10.3'
# Expected matches:
# <span class="badge">v2.10.0 Web</span>
# <link rel="stylesheet" href="src/css/styles.css?v=2.10.3">
# <script type="module" src="src/js/app.js?v=2.10.3"></script>

# 2. Verify standalone legal pages return HTTP 200 with canonical content
for page in about.html terms.html privacy.html; do
  echo -n "$page: "
  curl -s -o /dev/null -w "%{http_code}\n" "https://dayflowlive.com/$page"
done
# Expected:
# about.html: 200
# terms.html: 200
# privacy.html: 200
```

### Smoke Test 6: End-to-End Browser Verification
Open `https://dayflowlive.com` in a browser:
1. **Login Screen Footer Links:**
   - Click **About Us**, **Terms & Conditions**, and **Privacy Policy** -> opens the in-app legal modal smoothly.
   - Click **↗ Full Page** inside the modal -> opens `/about.html` (or `/terms.html`, `/privacy.html`). Switching tabs on the full page updates instantly without page flicker, and clicking **← Launch DayFlow** returns directly to the login screen.
2. **Login & "NOW" Cell Auto-Centering:**
   - Sign in to an account -> the schedule grid automatically scrolls to center the current **"📍 NOW"** 30-minute time slot.
   - Refresh the browser page (`F5` / `Ctrl+R`) -> the schedule grid smoothly re-centers on the **"📍 NOW"** cell.
3. **Header Badge:** Displays **`v2.10.0 Web`**.
4. **Settings -> Danger Zone (Delete Account):**
   - "Delete My Account" section is visible at the bottom of Settings with confirmation safeguards.

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

If a critical issue is discovered post-deployment, execute this rollback procedure to revert to the previous release tag (`v2.9.0` or `v2.8.0`):

```bash
cd /var/www/dayflow

# 1. Checkout previous release tag (replace with recorded baseline tag from Step 5.2)
git checkout v2.9.0

# 2. Rebuild server bundle
cd /var/www/dayflow/server
npm ci --omit=dev
npm run build

# 3. Reload PM2 process
pm2 reload dayflow-api --update-env

# 4. Reload Nginx
sudo systemctl reload nginx

# 5. Verify rollback health
curl -s https://dayflowlive.com/api/health | jq .
```
*(Note: Database rollback is NOT required. The additive `users.is_disabled` column defaults to `false` and `user_categories` table remains safely dormant in PostgreSQL without impacting prior releases.)*

---

## 9. Post-Execution Log & Production Sign-Off Certificate

*(Note: To be completed by the Deployment Team upon executing the rollout.)*

### Live Verification Checklist
- [ ] **API Root Endpoint:** `curl -s https://dayflowlive.com/api/` reports `"version":"2.10.0"` and `"status":"online"`.
- [ ] **API Health Endpoint:** `curl -s https://dayflowlive.com/api/health` reports `"version":"2.10.0"` and `"database":"connected"`.
- [ ] **Account Deletion & Auth Guards:** Unauthenticated `DELETE /api/auth/account` and `/api/auth/me` return `401`.
- [ ] **Admin CLI Operational:** `npm run admin -- stats` executes cleanly over SSH.
- [ ] **Legal Pages Live:** `/about.html`, `/terms.html`, and `/privacy.html` return `200 OK`.
- [ ] **Frontend Web Assets:** Header badge displays `v2.10.0 Web`; assets reference `v=2.10.3`; "NOW" cell auto-centers on login and refresh.
- [ ] **HelpFinder4U Coexistence:** `hf-web` and `hf-api` remain online; restart counts unchanged.

### Execution Log & Sign-Off Record

```
========================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.10.0
========================================================================
Deployment Date:     ____________________ (YYYY-MM-DD)
Deployment Time:     ________ to ________ (UTC / Local)
Deployment Engineer: ____________________
Target Release Tag:  v2.10.0
Git Checkout Tag:    v2.10.0 confirmed (git describe --tags -> v2.10.0)
Commit SHA:          Confirmed via git rev-parse "v2.10.0^{commit}"
Database Migration:  npm run migrate -> users.is_disabled & user_categories verified
API Build Status:    tsc build successful (dayflow-server@2.10.0)
Admin CLI Check:     npm run admin -- stats verified
PM2 Process Status:  dayflow-api online, 0 unexpected restarts
API Health Check:    GET /api/health -> version: 2.10.0, database: connected
Legal Pages Check:   /about.html, /terms.html, /privacy.html -> HTTP 200 OK
Web Asset Check:     HTML header badge v2.10.0 Web, cache-buster ?v=2.10.3
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

