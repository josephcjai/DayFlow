# DayFlow v2.10.0 — Production Deployment Execution Log

**Date:** 2026-11-04 (server work 09:51–10:05 UTC)
**Deployed by:** Joseph C J
**Target:** AWS Lightsail `13.200.154.214` / `dayflowlive.com`, coexisting with HelpFinder4U
**Previous release:** `v2.9.0` (commit `0c9b584`), the rollback target
**Deployed release:** `v2.10.0` (commit `b10155f5f38310bff4f48931b1cb7c2cc8105e9d`, verified via `git rev-parse "v2.10.0^{commit}"`)
**Runbook followed:** [`DEPLOYMENT_v2.10.0_PRODUCTION.md`](./DEPLOYMENT_v2.10.0_PRODUCTION.md)
**Related records:** [`DEPLOYMENT_v2.9.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.9.0_EXECUTION_LOG.md), [`DEPLOYMENT_v2.8.0_EXECUTION_RECORD.md`](./DEPLOYMENT_v2.8.0_EXECUTION_RECORD.md), [`DEPLOYMENT_v2.6.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.6.0_EXECUTION_LOG.md), [`DEPLOYMENT_v2.5.0_EXECUTION_LOG.md`](./DEPLOYMENT_v2.5.0_EXECUTION_LOG.md)

**Final status: ✅ SUCCESS.** No rollback needed. No user-facing downtime. HelpFinder4U unaffected.

---

## 1. Summary

`v2.10.0` ships Self-Service Account Deletion (`DELETE /api/auth/account` and the `/api/auth/me` alias), a server-side Admin CLI (`npm run admin -- <command>`, zero public HTTP routes), standalone legal compliance pages (`about.html`, `terms.html`, `privacy.html`) served from the web root, and a fix for the schedule grid's "NOW" cell auto-centering on login and refresh (Finding 51). It also carries `v2.9.0`'s Custom Task Categories forward for any host still on `v2.8.0`.

The release includes one additive database change: `users.is_disabled BOOLEAN NOT NULL DEFAULT false`. This had to migrate **before** the API reload, because `authMiddleware.ts` runs `SELECT token_version, is_disabled FROM users WHERE id = $1` on every authenticated request — reloading the API against the old schema would have broken every authenticated call, not just new ones. The runbook's critical-ordering claim was verified against the code beforehand and confirmed accurate (unlike some "zero lock" claims in earlier runbooks that turned out to be overstated).

---

## 2. Pre-flight verification against the code

Before touching the server, the runbook's claims were checked against the `v2.10.0` tag and the live `authMiddleware.ts` / `authRoutes.ts` source:

| Claim | Result |
|---|---|
| Tag `v2.10.0` resolves to `b10155f…` | ✅ Confirmed |
| Migration must precede API reload | ✅ `authMiddleware.ts` queries `is_disabled` on every authenticated request — a real, high-stakes ordering requirement |
| Schema parity (Finding 50): `schema.sql` and `migrate.ts` both add `is_disabled` identically | ✅ Confirmed |
| No Node 22 regression (the `v2.9.0` near-miss didn't resurface) | ✅ `engines` still `>=20.0.0` |
| Account deletion requires auth + password verification (or typed confirmation for Google-only accounts), and cleans up every child table in dependency order before deleting the user row | ✅ Confirmed by reading `authRoutes.ts` |
| Finding 49 timing fix: `is_disabled` check happens *after* the password comparison that already returns the generic "Invalid email or password" response | ✅ Confirmed in code (the ~65–95ms constant-time claim itself wasn't independently measured — that's QA's territory, not something `curl` can prove) |
| No new runtime dependencies beyond transitive bumps (`body-parser`, `qs`) | ✅ Confirmed via `package-lock.json` diff |
| Runbook's expected boot log text (`DayFlow REST API Server running on port 5000 (production)`, `PostgreSQL connection pool established`) | ❌ Still wrong — same gap as every release since `v2.5.0` |

---

## 3. Pre-deployment health baseline (runbook §4.2)

- `dayflow-api` `online`, restart count `↺5`
- `hf-api` `online`, restart count `204`
- `hf-web` `online`, restart count `6`
- Nginx `active (running)`, but its own service uptime showed `Started` (not a reload) since `Oct 27 06:13:02 UTC` — a service-level event roughly a week after the `v2.9.0` deploy on Oct 11. Not something this deployment caused: PM2's restart counts for all three apps were unchanged from the `v2.9.0` session, so the application processes themselves were not restarted — most likely OS patching or a Lightsail-level event unrelated to DayFlow or HelpFinder4U.
- Live API `/api/health`: `200`, `version 2.9.0`, `database: connected`
- Host runtime: `node --version` → `v20.20.1`

---

## 4. Execution log

| Step | Action | Result |
|---|---|---|
| 2 | Pre-deploy database backup: `sudo -u postgres pg_dump -Fc dayflow_db` to `~/backups/dayflow_db_pre_v2.10.0_20261104_0952.dump` | `61K`, custom format, `54` TOC entries (up from `48` at `v2.8.0`, consistent with the `user_categories` table, its index, and its FK constraint added at `v2.9.0`). `pg_restore --list` showed a valid archive header and TOC. |
| 3 | Record rollback reference, fetch tags, checkout | Rollback target `0c9b584` (`v2.9.0`). `git fetch --tags origin` pulled `0c9b584..b10155f` on `main` plus the new `v2.10.0` tag. `git checkout v2.10.0` → `HEAD` `b10155f5f38310bff4f48931b1cb7c2cc8105e9d`, `git describe --tags` → `v2.10.0`, clean tree. `node --version` unchanged at `v20.20.1`. |
| 4 | Pre-migration check | `\d users` showed no `is_disabled` column |
| 4 | `npm run migrate` | `🔄 Running DayFlow PostgreSQL schema migrations...` / `✅ DayFlow schema migrations and indexes completed successfully!` |
| 4 | Post-migration check | `\d users` now shows `is_disabled \| boolean \| not null \| false`; all existing foreign-key relationships (`habit_logs`, `password_reset_tokens`, `schedule_weeks`, `user_categories`, `user_day_templates`) intact |
| 5 | `npm run build` | Exit `0`. Reports `dayflow-server@2.10.0`. `dist/server.js` (6433 bytes) and the new `dist/admin/cli.js` (18744 bytes) both compiled at 09:57 |
| 6 | `pm2 reload dayflow-api --update-env` | `↺5` → `↺6`. `hf-api` still `204`, `hf-web` still `6` |
| 6 | Boot logs | Final boot shows `🚀 DayFlow Express REST API running on http://localhost:5000` and `✅ Connected directly to PostgreSQL Database ('dayflow_db' on localhost:5432)!`. No Swagger line (production gate still working). Error log unchanged — still only the single pre-existing `invalid input syntax for type uuid: "1791182254274"` entry from Oct 5 |
| 7 | Verify legal pages present, `sudo nginx -t`, `sudo systemctl reload nginx` | `about.html` (25871 bytes), `privacy.html` (25883 bytes), `terms.html` (25891 bytes) all present in the web root, timestamped from the checkout. `syntax is ok`, `test is successful`, reload clean |

---

## 5. Post-deployment verification

**Command line (all passed, Smoke Tests 1–5 and §7):**
- Header badge `v2.10.0 Web` and both assets at `?v=2.10.4` ✅
- `GET /api/` → `version: "2.10.0"`, `status: "online"` ✅
- `GET /api/health` → `version: "2.10.0"`, `database: "connected"` ✅
- `DELETE /api/auth/account` (unauthenticated) → `401` ✅
- `DELETE /api/auth/me` (unauthenticated) → `401` ✅
- `GET /api/categories` (unauthenticated) → `401` ✅
- `GET /about.html`, `/terms.html`, `/privacy.html` → `200` each ✅
- `GET /docs` → `404` (Swagger still disabled in production) ✅
- `hf-api` (`204`) and `hf-web` (`6`) unchanged ✅

**Admin CLI (Smoke Test 4, `npm run admin -- stats`):**
```
Database Storage Footprint:  8623 kB
Total Registered Users:      4
 • Active Accounts:          4
 • Suspended Accounts:       0
 • Google Auth Users:        3
 • Password Auth Users:      2
Schedule Weeks:               7
Schedule Slots:               488  (5 productive)
Habit Logs:                   5
Todo Items:                   1    (0 completed)
Custom Categories:            28
Day Templates:                5
```
Ran cleanly over SSH with zero public HTTP exposure, as designed. `28 = 7 × 4` custom categories checks out exactly (7 defaults seeded per user, 4 users). See §6 for one numerical inconsistency worth flagging to the dev team.

**Browser (reported "everything looks fine" by the deployer):** The Smoke Test 6 checklist covered the legal-page footer links (in-app modal + "↗ Full Page" standalone navigation), the "NOW" cell auto-centering on both login and page refresh, the `v2.10.0 Web` header badge, and the Settings → Danger Zone "Delete My Account" section. As with the `v2.5.0`, `v2.6.0`, and `v2.8.0` logs, this was reported as "fine" without a per-item breakdown or screenshots. Anyone auditing this release should treat the browser pass as "reported fine," not "independently evidenced" — this gap has now recurred across four releases (see §7, item 4).

---

## 6. Issues and observations

**Runbook corrections (not blocking):**
1. **Wrong expected log text**, again. The runbook expects `DayFlow REST API Server running on port 5000 (production)` and `PostgreSQL connection pool established`. The actual lines are `🚀 DayFlow Express REST API running on http://localhost:5000` and `✅ Connected directly to PostgreSQL Database ('dayflow_db' on localhost:5432)!`. This has been true in every runbook since `v2.5.0` and has never been corrected.

**New observation — worth a look, not confirmed as a bug:**
2. **Admin CLI auth breakdown doesn't sum to the total.** `Total Registered Users: 4`, but `Google Auth Users: 3` + `Password Auth Users: 2` = `5`. The most likely explanation is a linked account — a user with both `google_id` and `password_hash` set (e.g., a Google sign-up who later set a password, or vice versa) — being counted in both buckets by two independent, non-mutually-exclusive `WHERE` clauses in the CLI's stats query. This doesn't affect `Total Registered Users` or `Active`/`Suspended`, which are correct by definition, but the sub-breakdown is misleading if read as a partition. Worth a quick look at `server/src/admin/cli.ts`'s stats query to confirm whether this is intentional (showing "how many users have each auth method available" rather than "how many users use each exclusively") or an oversight.

**Informational, not a problem:**
3. Nginx's own service uptime shows a fresh `Started` on `Oct 27`, about two weeks before this deploy and unrelated to it — PM2's restart counts for all three apps carried over unchanged from the `v2.9.0` session, confirming no application-level impact.

**Pre-existing bug, not introduced by this release:**
4. The error log still contains only the single pre-existing `invalid input syntax for type uuid: "1791182254274"` entry first seen during `v2.8.0` and traced back to `v2.7.0`-era browser testing (client-side `Date.now()` temporary IDs reaching a UUID column, `app.js:886`, `habits.js:480`). No new occurrences after this deploy. Still unresolved.

---

## 7. Rollback

**Not invoked.** Procedure: `git checkout v2.9.0` → `npm ci --omit=dev && npm run build` → `pm2 reload dayflow-api --update-env` → `sudo systemctl reload nginx`. The `is_disabled` column is additive and stays dormant on rollback, since `v2.9.0` doesn't reference it; no database rollback is required.

---

## 8. Follow-up items

1. Fix the runbook's expected boot log text (carried forward, unaddressed since `v2.5.0`).
2. Confirm whether the admin CLI's Google/Password auth sub-counts are meant to overlap for linked accounts, and if not, fix the query (§6 item 2).
3. Backlog, carried forward again: client-side `Date.now()` temporary IDs can still reach UUID columns and produce a `500` instead of a `4xx`. Still reachable, still not fixed.
4. Record browser smoke test results per item, with screenshots, for future releases — raised after `v2.5.0`, `v2.6.0`, and `v2.8.0`, still not actioned.
5. Still open: the `v2.7.0` browser checklist and execution log were never completed/written.

---

## 9. Sign-off

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.10.0
================================================================================
Deployment Date:     2026-11-04
Deployed By:         Joseph C J
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.10.0
Target Commit SHA:   b10155f5f38310bff4f48931b1cb7c2cc8105e9d
Pre-Deploy Status:   All services healthy (HF & DayFlow online)
Rollback Reference:  0c9b584 (v2.9.0)
DB Backup:           ~/backups/dayflow_db_pre_v2.10.0_20261104_0952.dump (61K, 54 TOC entries, valid)
DB Migration:        npm run migrate passed; users.is_disabled verified (boolean, not null, default false)
API Build Status:    tsc build successful (dayflow-server@2.10.0); dist/admin/cli.js compiled
PM2 Reload:          dayflow-api reloaded (↺5 -> ↺6), online, 0 new errors
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Legal Pages Check:   /about.html, /terms.html, /privacy.html -> HTTP 200 OK
Web Asset Check:     v2.10.0 Web badge and ?v=2.10.4 cache-buster confirmed live
API Health Check:    GET /api/health -> version 2.10.0, database connected
Auth Guards:         DELETE /api/auth/account, /api/auth/me, GET /api/categories -> 401 unauthenticated
Admin CLI Check:     npm run admin -- stats verified over SSH, zero public exposure
Swagger Check:       /docs returns 404 in production mode
HelpFinder Health:   hf-web and hf-api verified untouched (restart counts unchanged: 204 / 6)
Browser Smoke Test:  Reported "everything looks fine" by deployer; per-item detail not recorded
Final Status:        SUCCESS
================================================================================
```
