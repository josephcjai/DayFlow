# DayFlow v2.8.0 — Production Deployment Execution Log & Checklist

| Execution Metadata | Details |
|---|---|
| **Target Release** | **`v2.8.0`** |
| **Certified Tag** | **`v2.8.0`** |
| **Certified Commit SHA** | `7b4dd012fc5808df23463b603d32ec71c2a32b39` |
| **Target Host** | AWS Lightsail `13.200.154.214` (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` / `https://www.dayflowlive.com` |
| **Coexisting App** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **STRICTLY UNTOUCHED** |
| **Previous Production Release** | `v2.7.0` (Commit `a094f6b`) |
| **Runbook Reference** | [`docs/DEPLOYMENT_v2.8.0_PRODUCTION.md`](./DEPLOYMENT_v2.8.0_PRODUCTION.md) |
| **QA Sign-Off Reference** | [`temp/2026-10-06-qa-v2.8.0-release-retest.md`](../temp/2026-10-06-qa-v2.8.0-release-retest.md) |

---

## 1. Release Summary & QA Certification Status

- **Status:** ✅ **CERTIFIED & READY FOR PRODUCTION PROMOTION**
- **QA Verification (2026-10-06):**
  - **Full Regression Suite:** 155 API + 109 E2E tests passed across two consecutive clean runs with 0 retries.
  - **Production Mode:** 14/14 tests passed under `NODE_ENV=production`.
  - **Finding 45 Verified Live:** Omitted and partial saves preserve existing `isProductive` state via `COALESCE` query semantics; `null` correctly clears it.
  - **Asset Version:** Aligned to `?v=2.9.23` across 42 references (2 in `index.html`, 40 across JS modules).
  - **Database Migration:** Additive column `schedule_slots.is_productive BOOLEAN` (`ALTER TABLE ADD COLUMN IF NOT EXISTS`).

---

## 2. Standing Pre-Flight Coexistence Rules

> [!CAUTION]
> 1. **DO NOT run `sudo systemctl restart postgresql`:** PostgreSQL is shared with live **HelpFinder4U**.
> 2. **DO NOT touch HelpFinder PM2 processes or folders:** Never touch `/var/www/helpfinder` or `hf-*`.
> 3. **DO NOT execute `pm2 restart all`:** Only reload `dayflow-api` specifically.
> 4. **DO NOT reboot the host:** Host reboot causes service interruptions for all hosted applications.

---

## 3. Pre-Deployment Health Baseline Checklist

```bash
# 1. Connect via SSH
ssh -i LightsailDefaultKey-ap-south-1.pem ubuntu@13.200.154.214

# 2. Record Pre-Deploy PM2 Status
pm2 status
```

**Fill in baseline counts:**
- [ ] `hf-web`: Status `online` | Restart Count: `______`
- [ ] `hf-api`: Status `online` | Restart Count: `______`
- [ ] `dayflow-api`: Status `online` | Restart Count: `______`
- [ ] Nginx status: `sudo systemctl status nginx --no-pager` -> `active (running)`
- [ ] Live API baseline: `curl -s https://dayflowlive.com/api/health` -> HTTP 200 (v2.7.0)

---

## 4. Step-by-Step Execution Log

| # | Step | Exact Command | Expected Output / Check | Logged Status |
|---|---|---|---|:---:|
| **1** | Record Rollback Pin | `cd /var/www/dayflow && git log -1 --oneline` | `a094f6b` (tag `v2.7.0`) | `[ ]` |
| **2** | Fetch Tags | `git fetch --tags origin` | Latest tags fetched | `[ ]` |
| **3** | Checkout Release | `git checkout v2.8.0` | `HEAD detached at v2.8.0` | `[ ]` |
| **4** | Verify Commit SHA | `git rev-parse HEAD` | `7b4dd012fc5808df23463b603d32ec71c2a32b39` | `[ ]` |
| **5** | Verify Clean Tree | `git status` | `nothing to commit, working tree clean` | `[ ]` |
| **6** | **Execute DB Migration**<br>*(MUST precede API reload)* | `cd /var/www/dayflow/server && npm run migrate` | `✅ DayFlow schema migrations and indexes completed successfully!` | `[ ]` |
| **7** | Verify Column in DB | `sudo -u postgres psql -d dayflow_db -c "\d schedule_slots"` | `is_productive \| boolean` present | `[ ]` |
| **8** | Rebuild Server TypeScript | `npm run build` | Zero errors (`echo $?` -> `0`), `dist/server.js` generated | `[ ]` |
| **9** | Graceful PM2 Reload | `pm2 reload dayflow-api --update-env` | Status `online`, restart count increments by 1 | `[ ]` |
| **10** | Verify API Boot Logs | `pm2 logs dayflow-api --lines 25 --nostream` | `DayFlow REST API Server running on port 5000 (production)`, `Database connected` | `[ ]` |
| **11** | Test Nginx Syntax | `sudo nginx -t` | `syntax is ok, test is successful` | `[ ]` |
| **12** | Reload Nginx | `sudo systemctl reload nginx` | Clean reload, active | `[ ]` |

---

## 5. Post-Deployment Verification & Smoke Tests

Execute these validation commands immediately following Step 12:

```bash
# 1. Verify cache-busted asset parameters (2.9.23)
curl -s https://dayflowlive.com/index.html | grep -E "styles.css\?v=|app.js\?v="
# -> Expect:
#    <link rel="stylesheet" href="src/css/styles.css?v=2.9.23">
#    <script type="module" src="src/js/app.js?v=2.9.23"></script>

# 2. Verify API Health Endpoint
curl -s https://dayflowlive.com/api/health
# -> Expect:
#    {"status":"online","database":"connected","service":"DayFlow API Server","version":"2.8.0",...}

# 3. Verify API Root Info Endpoint
curl -s https://dayflowlive.com/api/ | grep '"version":"2.8.0"'
# -> Expect match

# 4. Verify Swagger UI remains disabled in production (Finding 39)
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/docs
# -> Expect: 404

# 5. Verify /api/templates requires authentication
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/templates
# -> Expect: 401

# 6. Verify HelpFinder4U processes are 100% unaffected
pm2 status hf-api
pm2 status hf-web
# -> Expect: both online, zero unexpected restarts
```

---

## 6. Browser Verification Matrix

Open `https://dayflowlive.com` in a browser and complete the smoke test:

- [ ] **Header Badge:** Displays `v2.8.0 Web`.
- [ ] **Network Inspector:** `styles.css?v=2.9.23` and `app.js?v=2.9.23` serve HTTP 200.
- [ ] **Focus Analytics:** Work Effectiveness KPI card displays active percentage (or `0%` if no actual minutes logged, no `NaN`).
- [ ] **Task Editor Modal:** Slot editing modal displays the `⚡ Mark as Productive Task` checkbox and saves choice accurately.
- [ ] **Settings Screen:** 2-column layout displays 4 organized sections with productive categories toggles functioning.

---

## 7. Emergency Rollback Runbook (If Needed)

```bash
# 1. Navigate to application directory
cd /var/www/dayflow

# 2. Checkout previous stable release tag v2.7.0
git checkout v2.7.0

# 3. Rebuild API bundle for v2.7.0
cd /var/www/dayflow/server
npm run build

# 4. Gracefully reload PM2
pm2 reload dayflow-api --update-env

# 5. Reload Nginx
sudo systemctl reload nginx

# 6. Confirm rollback
curl -s https://dayflowlive.com/api/health | grep '"version":"2.7.0"'
```

*(Note: The `is_productive` column is additive and safely dormant if rolled back to v2.7.0).*
