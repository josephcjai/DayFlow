# DayFlow v2.9.0 — Production Deployment Execution Log & Checklist

| Execution Metadata | Details |
|---|---|
| **Target Release** | **`v2.9.0`** |
| **Certified Tag** | **`v2.9.0`** |
| **Target Host** | AWS Lightsail `13.200.154.214` (User: `ubuntu`) |
| **Domain** | `https://dayflowlive.com` / `https://www.dayflowlive.com` |
| **Coexisting App** | **HelpFinder4U** (`hf-web`, `hf-api`, `helpfinder_db`) — **STRICTLY UNTOUCHED** |
| **Previous Production Release** | `v2.8.0` (Commit `7b4dd01`) |
| **Runbook Reference** | [`docs/DEPLOYMENT_v2.9.0_PRODUCTION.md`](./DEPLOYMENT_v2.9.0_PRODUCTION.md) |
| **QA Sign-Off Reference** | [`temp/2026-10-10-qa-notification-quiet-hours.md`](../temp/2026-10-10-qa-notification-quiet-hours.md) |

---

## 1. Release Summary & QA Certification Status

- **Status:** ✅ **CERTIFIED & READY FOR PRODUCTION PROMOTION**
- **QA Verification (2026-10-10):**
  - **Full Regression Suite:** 316 checks passing (176 API + 140 E2E tests) across two clean consecutive runs.
  - **Production Mode:** 14/14 tests passed under `NODE_ENV=production`.
  - **Security Hardening:** System category "General" archive protection returns HTTP 400; unconditional UUID format validation.
  - **Outage Resilience:** Pending save queue protects category mutations across reloads and syncs.
  - **Notification Controls:** Active window, Quiet Hours, Weekend Silence, and Productive-Only filters verified.
  - **Asset Version:** Aligned to `?v=2.9.29` across all 43 references.
  - **Database Migration:** Table `user_categories` and default category auto-seeding.

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
- [ ] Live API baseline: `curl -s https://dayflowlive.com/api/health` -> HTTP 200 (v2.8.0)

---

## 4. Step-by-Step Execution Log

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

## 5. Post-Deployment Verification & Smoke Tests

```bash
# 1. Verify API Root reports version 2.9.0
curl -s https://dayflowlive.com/api/ | grep '"version":"2.9.0"'

# 2. Verify Health Endpoint reports version 2.9.0 and database connected
curl -s https://dayflowlive.com/api/health | grep '"version":"2.9.0"'

# 3. Verify Categories API responds
curl -s -o /dev/null -w "%{http_code}\n" https://dayflowlive.com/api/categories
# Expected: 401 (auth required)

# 4. Verify Static Frontend Assets
curl -s https://dayflowlive.com/ | grep -E 'v2.9.0 Web|v=2.9.29'

# 5. Verify HelpFinder4U was untouched
pm2 status | grep -E 'hf-web|hf-api'
curl -s -I http://127.0.0.1:5001/api/health | head -n 1
```

- [ ] **API Root:** Reports `"version":"2.9.0"` and `"status":"online"`.
- [ ] **API Health:** Reports `"version":"2.9.0"` and `"database":"connected"`.
- [ ] **Categories Endpoint:** Protected by auth; UUID validation active.
- [ ] **Web Asset Cache-Busting:** Header badge confirms `v2.9.0 Web`, assets reference `v=2.9.29`.
- [ ] **Settings UI:** Custom Task Categories and Quiet Hours controls load cleanly.
- [ ] **HelpFinder4U:** Processes remain online; restart counts unchanged.

---

## 6. Execution Sign-Off

- **Deployment Result:** `[ ] SUCCESS` | `[ ] ROLLBACK TRIGGERED`
- **Executed By:** ____________________
- **Date & Time:** ____________________
- **Notes / Observations:** __________________________________________________
