# DayFlow v2.8.0 — Production Deployment Execution Record

**Date:** 2026-10-06 (server work 12:09–12:20 UTC)
**Deployed by:** Joseph C J
**Target:** AWS Lightsail `13.200.154.214` / `dayflowlive.com`, coexisting with HelpFinder4U
**Previous release:** `v2.7.0` (commit `a094f6b`), the rollback target
**Deployed release:** `v2.8.0` (commit `7b4dd01`, verified via `git rev-parse "v2.8.0^{commit}"`)
**Runbook followed:** [`DEPLOYMENT_v2.8.0_PRODUCTION.md`](./DEPLOYMENT_v2.8.0_PRODUCTION.md)
**Dev team checklist (left unmodified):** [`DEPLOYMENT_v2.8.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.8.0_EXECUTION_LOG.md)
**Related records:** [`DEPLOYMENT_v2.6.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.6.0_EXECUTION_LOG.md), [`DEPLOYMENT_v2.5.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.5.0_EXECUTION_LOG.md), [`DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md`](./DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md)

**Final status: ✅ SUCCESS.** No rollback needed. No user-facing downtime. HelpFinder4U unaffected.

---

## 1. Summary

`v2.8.0` adds the Work Effectiveness KPI, per-slot productive classification (`schedule_slots.is_productive`), and a 2-column Settings layout. The release includes one additive database change: a nullable `is_productive BOOLEAN` column on `schedule_slots`.

The migration had to run before the API reload, because the new week query selects `s.is_productive`. The runbook's ordering was followed.

---

## 2. Pre-flight verification against the code

Before touching the server, the runbook's claims were checked against the `v2.8.0` tag:

| Claim | Result |
|---|---|
| Tag resolves to `7b4dd012…` | ✅ Confirmed |
| Migration is additive | ✅ `ALTER TABLE schedule_slots ADD COLUMN IF NOT EXISTS is_productive BOOLEAN;` only |
| API queries the column, so the migration must come first | ✅ `scheduleRoutes.ts` selects `s.is_productive` in the week query |
| Rollback to `v2.7.0` is safe | ✅ `v2.7.0` has zero references to `is_productive` |
| Asset version `2.9.23` across 42 references | ✅ 2 in `index.html`, 40 in modules |
| `APP_VERSION` and `package.json` at `2.8.0` | ✅ |
| Runbook's expected startup log text | ❌ Wrong. See §6 |

---

## 3. Pre-deployment health baseline (runbook §4.2)

- `dayflow-api` `online`, restart count `↺3`
- `hf-api` `online`, restart count `204`
- `hf-web` `online`, restart count `6`
- Nginx `active (running)`
- Live API `/api/health`: `200`, `version 2.7.0`, `database: connected`

---

## 4. Execution log

| Step | Action | Result |
|---|---|---|
| 2 | Pre-deploy database backup: `pg_dump -Fc dayflow_db` to `~/backups/dayflow_db_pre_v2.8.0_20261006_1210.dump` | 44K, custom format, 48 TOC entries (up from 43 at v2.7.0, consistent with the `user_day_templates` table added in v2.7.0). `pg_restore --list` valid. |
| 3 | Record rollback reference, fetch tags, checkout | Rollback target `a094f6b` (`v2.7.0`). `git checkout v2.8.0` → HEAD `7b4dd01`, clean tree |
| 4 | Pre-migration check | `\d schedule_slots` showed no `is_productive` column |
| 4 | `npm run migrate` | `✅ DayFlow schema migrations and indexes completed successfully!` |
| 4 | Post-migration check | `is_productive | boolean`, nullable, no default. Existing slots read as `null` (unclassified) |
| 5 | `npm run build` | Exit `0`. Reports `dayflow-server@2.8.0`. `dist/server.js` and `dist/routes/scheduleRoutes.js` regenerated 12:15 |
| 6 | `pm2 reload dayflow-api --update-env` | `↺3` → `↺4`. `hf-api` still `204`, `hf-web` still `6` |
| 6 | Boot logs | Final boot shows `🚀 DayFlow Express REST API running…` and `✅ Connected directly to PostgreSQL Database`. No Swagger line (production gate working). Error log showed only the pre-existing entry from §6 |
| 7 | `sudo nginx -t` / `sudo systemctl reload nginx` | `syntax is ok`, `test is successful`, reload clean |

---

## 5. Post-deployment verification

**Command line (all passed):**
- `index.html` serves `styles.css?v=2.9.23` and `app.js?v=2.9.23` ✅
- `GET /api/` → `version 2.8.0`, `templates` endpoint listed ✅
- `GET /api/health` → `version 2.8.0`, `database: connected` ✅
- `GET /api/templates` → `401` (JWT-protected) ✅
- `GET /docs` → `404` (Swagger disabled in production) ✅
- `hf-api` (`204`) and `hf-web` (`6`) unchanged ✅

**Browser (reported "looks fine" by the deployer):** The checklist covered the `v2.8.0 Web` badge, the Work Effectiveness card, the productive-task checkbox in the slot editor, the 2-column Settings layout, and todo add/toggle/delete. Per-item detail and screenshots were not captured in this record. Anyone auditing this release should treat the browser pass as "reported fine," not "independently evidenced."

**Error log after the browser pass:** No new entries. The only entry is the pre-existing one described in §6.

---

## 6. Issues and observations

**Runbook corrections (not blocking):**
1. **Wrong expected log text.** The runbook expects `DayFlow REST API Server running on port 5000 (production)` and `Database connected`. The actual lines are `🚀 DayFlow Express REST API running on http://localhost:5000` and `✅ Connected directly to PostgreSQL Database ('dayflow_db' on localhost:5432)!`. This was also true in the v2.6.0 and v2.7.0 runbooks.
2. **"Zero lock contention" is overstated.** `ADD COLUMN` takes a brief lock on `schedule_slots`, and the migration also re-runs existing `ALTER` statements on `users`, `todo_items`, and `schedule_weeks`. At this data size the locks last milliseconds. The runbook should say "brief lock, milliseconds."
3. **No backup step in the runbook.** A pre-migration `pg_dump -Fc dayflow_db` was added here and should be standard.

**Pre-existing bug, not introduced by this release:**
- The error log contains `invalid input syntax for type uuid: "1791182254274"` returning `500`. The timestamp decodes to `Oct 5 2026 06:37 UTC`, about 15 minutes after the v2.7.0 deploy, so it came from browser testing that day.
- Most likely cause: adding a todo creates a temporary local ID with `Date.now()` (`src/js/app.js:886`) and replaces it with the server's UUID only after the API call succeeds. If that call failed and the todo was later changed, the temporary numeric ID reached the UUID column. I haven't traced the exact route, so this is a hypothesis.
- `Date.now()` IDs are still generated in several places in `v2.8.0` (`app.js:886`, `habits.js:480`, and others). Confirmed still present, so the bug is still reachable.
- The API returns `500` for an invalid ID. It should return a `4xx`.
- No new occurrences were seen after this deploy.

---

## 7. Rollback

**Not invoked.** Procedure: `git checkout v2.7.0` → `npm run build` → `pm2 reload dayflow-api --update-env` → `sudo systemctl reload nginx`. The `is_productive` column is additive and stays dormant on rollback, since `v2.7.0` doesn't reference it.

---

## 8. Follow-up items

1. Update the runbook's expected log text to match the actual startup lines (item 1 above).
2. Reword the "zero lock" claim and add a backup step to the runbook template.
3. Backlog: fix client-side temporary IDs reaching UUID columns, and make the API return `4xx` for invalid IDs.
4. Carried from the v2.8.0 QA backlog: upgrade the `proxy-addr` transitive dependency (`>= 2.0.8`) and evaluate Node 22 for the Google Auth dependencies.
5. Browser checklist results should be recorded per item, with screenshots, for future releases.
6. The `v2.7.0` browser checklist and execution log are still missing (see the separate open item).

---

## 9. Sign-off

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.8.0
================================================================================
Deployment Date:     2026-10-06
Deployed By:         Joseph C J
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.8.0
Target Commit SHA:   7b4dd012fc5808df23463b603d32ec71c2a32b39
Pre-Deploy Status:   All services healthy (HF & DayFlow online)
Rollback Reference:  a094f6b (v2.7.0)
DB Backup:           ~/backups/dayflow_db_pre_v2.8.0_20261006_1210.dump (44K, valid)
DB Migration:        npm run migrate passed; schedule_slots.is_productive verified
API Build Status:    tsc build successful (dayflow-server@2.8.0)
PM2 Reload:          dayflow-api reloaded (↺3 -> ↺4), online, 0 new errors
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.23 & app.js?v=2.9.23 confirmed live
API Health Check:    GET /api/health -> version 2.8.0, database connected
Templates Route:     GET /api/templates -> 401 Unauthorized (JWT protected)
Swagger Check:       /docs returns 404 in production mode
HelpFinder Health:   hf-web and hf-api verified untouched (204 / 6)
Browser Smoke Test:  Reported "looks fine" by deployer; per-item detail not recorded
Final Status:        SUCCESS
================================================================================
```
