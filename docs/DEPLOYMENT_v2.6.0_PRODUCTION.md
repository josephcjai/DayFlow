# DayFlow v2.6.0 — Production Deployment Runbook
## Reusable Day Templates, Grid Quick Actions & Stability Fixes Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.5.0` (Commit `514bd42`) |
| **Target Release Version** | **`v2.6.0`** (or `v2.5.1` if preferred as patch) |
| **Target Commit** | `d4fd8ef` on branch `main` |
| **Deployment Type** | In-place zero-downtime upgrade (Frontend features + API rebuild + Cache invalidation) |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's New in `v2.6.0`:
1. **Reusable Day Templates (`6594984`, `d4fd8ef`):**
   - User Settings Card 7 for creating, editing, and deleting customizable routines.
   - Built-in templates (*Productive Workday*, *Weekend Reset & Leisure*).
   - "Apply Template to Day" with strict **Least Priority Rule** (existing occupied slots are never overwritten).
   - "Save Today as Template" flow directly from the Day View header.
   - Themed confirmation modal for template deletion (Finding 42).
2. **Grid Quick Status Actions & Inline Editing (`a718312`, `d4fd8ef`):**
   - Click to toggle Done, right-click for quick status popover, alt/shift+click to cycle.
   - Direct inline click/key editing for task titles (Enter to commit, Escape to cancel).
   - Direct inline click/key editing for actual duration badges.
   - Smart duration auto-rules (Not Done → 0m, Partially Done → planned/2, Done → planned).
3. **Data Loss Prevention & Offline Sync Hardening (`d4fd8ef` — Finding 41):**
   - Persistent `pendingSlotSaves` stored in `localStorage` under `dayflow_pending_slots_<userId>`.
   - `syncWeekDataWithApi` guarded against overwriting pending local edits on reload during server outages.
   - Automatic background retry queue that syncs pending slots once network connectivity recovers.
4. **Header Layout Manager Enhancements (`3fbf84e`, `d4fd8ef` — Findings 38 & 40):**
   - Measure actual content slack to prevent idle oscillation with long display names (Finding 38).
   - Accurate container slack calculation allowing `nav-compact` and `actions-compact` to cleanly release when widening back to wide viewports (Finding 40).
5. **Production Hardening (`3fbf84e` — Findings 37 & 39):**
   - Unified API version constant across `GET /api` and `GET /api/health`.
   - Swagger UI (`/docs`, `/api-docs`) disabled in production mode (`NODE_ENV=production`) returning clean 404.
6. **Live Grid Clock Ticker (`447e27e`):**
   - Dynamic 30-minute interval ticker updating the NOW indicator line in real-time without requiring a page refresh.
7. **Static Asset Cache Busting:**
   - Asset query string bumped to `?v=2.9.14` across `index.html` and all JavaScript modules.

### What is NOT Changing (Risk Assessment: LOW):
- **Database Schema:** **NO migrations required.** Database tables remain unchanged (6 tables: `users`, `schedule_weeks`, `schedule_slots`, `habit_logs`, `todo_items`, `password_reset_tokens`).
- **Database Connection & Credentials:** No changes to PostgreSQL port `5432` or database credentials.
- **Environment Configuration:** **NO `.env` modifications required.**
- **HelpFinder4U:** **100% ISOLATED.** DayFlow does not share PM2 processes, directories, or database tables with HelpFinder.

---

## 2. Release Tagging Decision: Should We Create a Tag?

> [!IMPORTANT]
> **YES, creating an explicit git release tag is strongly recommended.**
> 
> Here is why:
> 1. **Immutable Deployment Boundary:** Checking out an exact tag (e.g. `git checkout v2.6.0`) ensures production runs the exact tested code snapshot and cannot be polluted by ongoing development commits on `main`.
> 2. **60-Second Instant Rollback:** If any unforeseen issue occurs in production, rolling back is as simple as `git checkout v2.5.0 && pm2 reload dayflow-api`.
> 3. **QA & Audit Alignment:** The independent QA test suite (`dayflow-qa`) pins test runs against tags.
> 
> **Recommended Tag Name: `v2.6.0`** (Semantic Versioning: Minor release introducing new user-facing features like Day Templates and Grid Quick Actions without breaking API compatibility).

### Step to Create & Push the Tag (Run from Local Workstation):
```bash
# Ensure local main is clean and up-to-date with remote
git checkout main
git pull origin main

# Create the annotated release tag
git tag -a v2.6.0 -m "Release v2.6.0: Reusable Day Templates, Grid Quick Actions, and Stability Fixes"

# Push the tag to remote GitHub repository
git push origin v2.6.0
```

---

## 3. Safety Rules & Multi-App Coexistence Constraints

> [!CAUTION]
> **CRITICAL PRODUCTION SAFETY RULES FOR DEPLOYMENT TEAM:**
> 1. **DO NOT restart PostgreSQL service:** Never run `sudo systemctl restart postgresql`. PostgreSQL is shared with HelpFinder4U.
> 2. **DO NOT touch HelpFinder directories:** Do not modify anything under `/var/www/helpfinder` or `/etc/nginx/sites-available/helpfinder*`.
> 3. **DO NOT run `pm2 restart all`:** Only target the DayFlow service: `pm2 reload dayflow-api --update-env`.
> 4. **DO NOT reboot the server:** A server reboot will cause downtime for all hosted applications.

---

## 4. Pre-Deployment Preparation & Health Verification

### Step 4.1: Connect to Server via SSH
From your local terminal with the private key:
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

### Step 4.2: Verify Pre-Deployment Service Health
Run the following commands to ensure existing services are healthy before starting:

```bash
# 1. Verify PM2 processes (both HelpFinder and DayFlow should be online)
pm2 status

# Expected output:
# - hf-web (online)
# - hf-api (online)
# - dayflow-api (online, port 5000)

# 2. Verify Nginx status
sudo systemctl status nginx --no-pager

# 3. Test current live site response
curl -I https://dayflowlive.com/api/auth/config
# (Should return HTTP/2 200 OK)
```

---

## 5. Step-by-Step Deployment Procedure

### Step 5.1: Navigate to DayFlow Application Root
```bash
cd /var/www/dayflow
```

### Step 5.2: Backup Current Release Pointer
Note the current commit/tag so you have an immediate reference:
```bash
git log -1 --oneline
# (Expected: commit corresponding to tag v2.5.0)
```

### Step 5.3: Fetch Latest Tags & Checkout `v2.6.0`
```bash
# Fetch latest remote changes and tags from GitHub
git fetch --tags origin

# Checkout the certified production release tag v2.6.0
git checkout v2.6.0
```

Verify that the working tree is cleanly on `v2.6.0`:
```bash
git describe --tags
# Output must be: v2.6.0

git status
# Output must show: HEAD detached at v2.6.0, nothing to commit, working tree clean
```

---

### Step 5.4: Rebuild Server API (Build Validation)
Recompile TypeScript to update `dist/` with the unified version and Swagger production gate:

```bash
cd /var/www/dayflow/server

# Build the TypeScript production bundle
npm run build
```

Verify that `dist/` is generated cleanly:
```bash
ls -la dist/server.js dist/db/migrate.js
```

---

### Step 5.5: Reload PM2 Service (Zero-Downtime Reload)
Reload the `dayflow-api` process gracefully:

```bash
# Reload dayflow-api specifically (DO NOT USE 'pm2 restart all')
pm2 reload dayflow-api --update-env

# Verify process status
pm2 status
```

Check the latest logs to confirm the API booted without errors:
```bash
pm2 logs dayflow-api --lines 25 --nostream
```
*(Look for: `Server running on port 5000` and `Database connected`)*.

---

### Step 5.6: Reload Nginx Web Server
Reload Nginx to flush any static file handle caches:

```bash
# 1. Test Nginx syntax
sudo nginx -t
# (Must report: syntax is ok, test is successful)

# 2. Gracefully reload Nginx
sudo systemctl reload nginx
```

---

## 6. Post-Deployment Verification & Smoke Tests

Execute these verification checks immediately following reload:

### 6.1 Automated Command-Line Checks
Run from the server or your local machine:

```bash
# 1. Verify index.html serves the v=2.9.14 cache-busting query strings
curl -s https://dayflowlive.com/index.html | grep -E "styles.css\?v=|app.js\?v="

# Expected output:
#   <link rel="stylesheet" href="src/css/styles.css?v=2.9.14">
#   <script type="module" src="src/js/app.js?v=2.9.14"></script>

# 2. Verify API Root Endpoint & Version Agreement
curl -s https://dayflowlive.com/api/
# Expected: {"name":"DayFlow REST API","version":"2.6.0","status":"online",...}

# 3. Verify API Health Endpoint
curl -s https://dayflowlive.com/api/health
# Expected: {"status":"healthy","database":"connected","version":"2.6.0",...}

# 4. Verify Swagger Docs are Gated (HTTP 404 in production - Finding 39)
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/docs
# Expected: 404

# 5. Verify HelpFinder4U was NOT affected
pm2 status hf-api
pm2 status hf-web
# (Both must remain online with restart counts unchanged from baseline)
```

---

### 6.2 Browser Sanity & Smoke Test Checklist
Open `https://dayflowlive.com` in a browser (or incognito window):

1. **Asset Version Check:**
   - Open Developer Tools (`F12`) → Network tab.
   - Reload page (`Ctrl+F5` / `Cmd+Shift+R`).
   - Confirm `styles.css?v=2.9.14` and `app.js?v=2.9.14` return HTTP 200.
2. **Login / Dashboard Access:**
   - Sign in with an existing account or demo mode.
   - Confirm Schedule Grid loads without console errors.
3. **Grid Quick Actions (Finding 41 & Feature Verification):**
   - Click the status button on any scheduled task to toggle status (Pending ↔ Done).
   - Right-click status button to open quick status menu (Done, Partially Done, Not Done, Pending).
   - Click task title to edit inline (Enter commits, Escape cancels).
   - Click actual duration badge to edit minutes inline.
4. **Day Templates (Finding 42 & Feature Verification):**
   - Navigate to **Settings** (`⚙️`) → Card 7 (**Day Templates**).
   - Confirm default templates (*Productive Workday*, *Weekend Reset & Leisure*) appear.
   - Click `+ New Template` and verify slot builder rows save properly.
   - Click `🗑️` on a template: verify themed `#deleteDayTemplateConfirmModal` appears (NOT native browser confirm dialog).
   - In Week View, click `📋` in any column header to test applying a template; verify the Least Priority Rule preview displays and fills only empty slots.
5. **Header Layout Uncompaction (Finding 40 Verification):**
   - Shrink browser width to ~1300px: verify header compacts gracefully.
   - Maximize or widen window to 1900px: verify `nav-compact` and `actions-compact` classes cleanly release and full navigation/action button labels reappear without requiring page reload.

---

## 7. Rollback Procedure (Emergency Fallback)

If any blocking issue arises during deployment, execute this immediate rollback procedure. Because no database migrations were run, rolling back to `v2.5.0` takes less than 60 seconds:

```bash
# 1. Navigate to application root
cd /var/www/dayflow

# 2. Revert code to previous release tag v2.5.0
git checkout v2.5.0

# 3. Recompile server
cd server
npm run build

# 4. Restart DayFlow PM2 service
pm2 reload dayflow-api --update-env

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Verify rollback
curl -s https://dayflowlive.com/index.html | grep "app.js\?v="
# (Should show: src/js/app.js?v=2.9.13 or v=2.9.7)
```

---

## 8. Deployment Team Sign-Off Template

Upon successful verification, record completion details:

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.6.0
================================================================================
Deployment Date:     YYYY-MM-DD
Deployed By:         [Engineer Name]
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.6.0
Pre-Deploy Status:   All services healthy (HF & DayFlow online)
Git Checkout Tag:    v2.6.0 confirmed (git describe --tags -> v2.6.0)
API Build Status:    tsc compilation successful (dist/ generated)
PM2 Reload:          dayflow-api online, 0 errors, clean reload
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.14 & app.js?v=2.9.14 confirmed live
Swagger Check:       /docs returns 404 in production mode
HelpFinder Health:   HelpFinder4U hf-web and hf-api verified 100% untouched
Final Status:        [ SUCCESS / ROLLED BACK ]
================================================================================
```
