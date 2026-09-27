# DayFlow v2.5.0 — Production Deployment Runbook
## UI Revamp, Responsive Navigation & Header Layout Manager Rollout

| Property | Details |
|---|---|
| **Target Server** | AWS Lightsail Instance (`13.200.154.214`) |
| **Operating System** | Ubuntu 24.04 LTS (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` and `https://www.dayflowlive.com` |
| **Coexisting Application** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **DO NOT TOUCH** |
| **Current Production Version** | `v2.4.1` (Commit `f0605e3`) |
| **Target Release Version** | **`v2.5.0`** |
| **Deployment Type** | In-place zero-downtime upgrade (Frontend UI revamp + Static Cache invalidation) |
| **Estimated Maintenance Window** | 5 – 10 minutes (Zero expected user downtime) |
| **Audience** | DevOps Engineers / Deployment Team / Site Reliability Engineers |

---

## 1. Release Overview & Architecture Impact

### What's Changing in `v2.5.0`:
- **Complete UI Revamp & Modernization:** Modernized dark-mode aesthetic, cohesive tokens, card layouts, and typography.
- **Unified Responsive Navigation:** Seamless switching between Desktop top navigation, tablet compact view, and mobile bottom navigation bar.
- **Multi-View Schedule Grid:** Added Day View, Weekly View, and Monthly 7-column Matrix with quick mobile horizontal scroller.
- **Structural Header Layout Manager:** Single-source-of-truth `ResizeObserver` controller in `src/js/app.js` with mathematically aligned CSS thresholds (`<= 1510px`, `<= 1315px`, `<= 800px`) eliminating all button clipping/overflow across all viewports (316px–1600px).
- **Static Asset Cache Busting:** Asset version bumped to `?v=2.9.7` across `index.html` and all 10 internal JavaScript modules.

### What is NOT Changing (Risk Assessment: LOW):
- **Database Schema:** **NO migrations required.** Database tables remain unchanged (6 tables: `users`, `schedule_weeks`, `schedule_slots`, `habit_logs`, `todo_items`, `password_reset_tokens`).
- **Backend API Routes:** **NO route modifications.** API endpoints and business logic are 100% backward compatible.
- **Environment Configuration:** **NO `.env` modifications required.**
- **HelpFinder4U:** **100% ISOLATED.** DayFlow does not share PM2 processes, directories, or database tables with HelpFinder.

---

## 2. Safety Rules & Multi-App Coexistence Constraints

> [!CAUTION]
> **CRITICAL PRODUCTION SAFETY RULES FOR DEPLOYMENT TEAM:**
> 1. **DO NOT restart PostgreSQL service:** Never run `sudo systemctl restart postgresql`. PostgreSQL is shared with HelpFinder4U.
> 2. **DO NOT touch HelpFinder directories:** Do not modify anything under `/var/www/helpfinder` or `/etc/nginx/sites-available/helpfinder*`.
> 3. **DO NOT run `pm2 restart all`:** Only target the DayFlow service: `pm2 restart dayflow-api`.
> 4. **DO NOT reboot the server:** A server reboot will cause downtime for all hosted applications.

---

## 3. Pre-Deployment Preparation & Health Verification

### Step 3.1: Connect to Server via SSH
From your local terminal with the private key:
```bash
chmod 400 LightsailDefaultKey-ap-south-1.pem
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214
```

### Step 3.2: Verify Pre-Deployment Service Health
Run the following commands to ensure existing services are healthy before starting:

```bash
# 1. Verify PM2 processes (both HelpFinder and DayFlow should be online)
pm2 status

# Expected output should show:
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

## 4. Step-by-Step Deployment Procedure

### Step 4.1: Navigate to DayFlow Application Root
```bash
cd /var/www/dayflow
```

### Step 4.2: Backup Current Release Pointer
Note the current commit/tag so you have an immediate reference:
```bash
git log -1 --oneline
# (Expected: commit corresponding to tag v2.4.1)
```

### Step 4.3: Fetch Latest Tags & Checkout `v2.5.0`
```bash
# Fetch latest remote changes and tags from GitHub
git fetch --tags origin

# Checkout the certified production release tag v2.5.0
git checkout v2.5.0
```

Verify that the working tree is cleanly on `v2.5.0`:
```bash
git describe --tags
# Output must be: v2.5.0

git status
# Output must show: HEAD detached at v2.5.0, nothing to commit, working tree clean
```

---

### Step 4.4: Rebuild Server API (Build Validation)
Although backend source files were not modified in `v2.5.0`, recompiling TypeScript ensures clean runtime alignment and confirms dependency integrity:

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

### Step 4.5: Reload PM2 Service (Zero-Downtime Reload)
Reload the `dayflow-api` process:

```bash
# Reload dayflow-api specifically (DO NOT USE 'pm2 restart all')
pm2 reload dayflow-api --update-env

# Verify process status
pm2 status
```

Check the latest logs to confirm the API booted without errors:
```bash
pm2 logs dayflow-api --lines 20 --nostream
```
*(Look for: `Server running on port 5000` and `Database connected`)*.

---

### Step 4.6: Reload Nginx Web Server
Reload Nginx to ensure any static file handle caches and buffer pools are flushed:

```bash
# 1. Test Nginx syntax
sudo nginx -t
# (Must report: syntax is ok, test is successful)

# 2. Gracefully reload Nginx
sudo systemctl reload nginx
```

---

## 5. Post-Deployment Verification & Smoke Tests

Execute these verification checks immediately following reload:

### 5.1 Automated Command-Line Checks
Run from the server or your local machine:

```bash
# 1. Verify index.html serves the v=2.9.7 cache-busting query strings
curl -s https://dayflowlive.com/index.html | grep -E "styles.css\?v=|app.js\?v="

# Expected output:
#   <link rel="stylesheet" href="src/css/styles.css?v=2.9.7">
#   <script type="module" src="src/js/app.js?v=2.9.7"></script>

# 2. Verify API Health & Configuration Endpoint
curl -s -i https://dayflowlive.com/api/auth/config

# Expected output:
#   HTTP/2 200
#   {"googleClientId":...,"allowRegistration":true,...}

# 3. Verify Swagger Documentation Endpoint
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/docs/
# Expected: 200 or 301

# 4. Verify HelpFinder4U was NOT affected
pm2 status hf-api
pm2 status hf-web
# (Both must remain online with 0 restarts)
```

---

### 5.2 Browser Sanity & Smoke Test Checklist
Open `https://dayflowlive.com` in a browser (or incognito window):

1. **Asset Version Check:**
   - Open Developer Tools (`F12`) → Network tab.
   - Reload page (`Ctrl+F5` / `Cmd+Shift+R`).
   - Confirm `styles.css?v=2.9.7` and `app.js?v=2.9.7` return HTTP 200.
2. **Login / Demo Mode:**
   - Sign in or click "Explore Sample Schedule in Demo Mode".
   - Confirm Schedule Grid loads without JavaScript errors in the console.
3. **Responsive Header Test:**
   - **Desktop (1440px+):** Verify full navigation labels and action buttons (Logout, Export, Import) are visible.
   - **Laptop / Narrow Desktop (1200px):** Verify action buttons smoothly switch to icon-only mode with no button clipping off the right edge.
   - **Tablet (768px – 900px):** Verify top navigation collapses into compact icons or mobile navigation bar.
   - **Mobile (375px):** Verify top header shows Logo + User Badge, and bottom navigation bar provides 1-tap switching between Grid, Habits, Notes, Analytics, and Settings.
4. **View Switching:**
   - Click through **Grid** (switch between Day, Week, and Month views).
   - Click **Habits**, **Notes & Todo**, **Analytics**, and **Settings**.
   - Verify all views render cleanly without layout overflow.

---

## 6. Rollback Procedure (Emergency Fallback)

If any critical issue arises during deployment, execute this immediate rollback procedure. Because database migrations were not run, rolling back to `v2.4.1` takes less than 60 seconds:

```bash
# 1. Navigate to application root
cd /var/www/dayflow

# 2. Revert code to previous release tag v2.4.1
git checkout v2.4.1

# 3. Recompile server
cd server
npm run build

# 4. Restart DayFlow PM2 service
pm2 reload dayflow-api

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Verify rollback
curl -s https://dayflowlive.com/index.html | grep "app.js\?v="
# (Should show: src/js/app.js?v=2.9.5)
```

---

## 7. Deployment Team Sign-Off Template

Upon successful verification, record completion details:

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.5.0
================================================================================
Deployment Date:     YYYY-MM-DD
Deployed By:         [Engineer Name]
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.5.0
Pre-Deploy Status:   All services healthy (HF & DayFlow online)
Git Checkout Tag:    v2.5.0 confirmed (git describe --tags -> v2.5.0)
API Build Status:    tsc compilation successful (dist/ generated)
PM2 Reload:          dayflow-api online, 0 errors
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.7 & app.js?v=2.9.7 confirmed live
HelpFinder Health:   HelpFinder4U hf-web and hf-api verified 100% untouched
Final Status:        [ SUCCESS / ROLLED BACK ]
================================================================================
```
