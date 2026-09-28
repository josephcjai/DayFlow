# DayFlow v2.5.0 — Production Deployment Execution Log

**Date:** 2026-09-27
**Deployed by:** Joseph C J
**Target:** AWS Lightsail `13.200.154.214` / `dayflowlive.com`, coexisting with HelpFinder4U
**Previous release:** `v2.4.1` (commit `8af0d99`)
**Deployed release:** `v2.5.0` (commit `514bd42`)
**Runbook followed:** [`DEPLOYMENT_v2.5.0_PRODUCTION.md`](./DEPLOYMENT_v2.5.0_PRODUCTION.md) — prepared by the dev team
**Related:** [`DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md`](./DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md) — the equivalent log for the original `v2.4.1` deploy, which surfaced several runbook gaps. **None of those gaps recurred here** — see §5.

**Final status: ✅ SUCCESS.** No rollback needed. Zero downtime for either DayFlow or HelpFinder4U.

---

## 1. Summary

This was a frontend-only release: UI revamp, unified responsive navigation (desktop/tablet/mobile), multi-view schedule grid (Day/Week/Month), a new `ResizeObserver`-based header layout manager, and a static asset cache-bust (`?v=2.9.7`). Per the runbook, **no database migrations, no backend route changes, and no `.env` changes** were required — this made it a materially lower-risk deploy than `v2.4.1`, and it executed with zero deviations from plan.

---

## 2. Pre-deployment health check (runbook §3.2)

Run before touching anything:
```bash
pm2 status
sudo systemctl status nginx --no-pager
curl -I https://dayflowlive.com/api/auth/config
```

Result: `dayflow-api`, `hf-api`, `hf-web` all `online`; Nginx `active (running)`; API returned `200 OK`. Clean baseline confirmed before proceeding.

---

## 3. Execution log (runbook §4)

| Step | Command(s) | Result |
|---|---|---|
| Record rollback reference | `git log -1 --oneline` | `8af0d99` (tag `v2.4.1`) — noted as the rollback target |
| Fetch + checkout release | `git fetch --tags origin` / `git checkout v2.5.0` | Fetched cleanly; checked out at `514bd42` |
| Verify checkout | `git describe --tags` / `git status` | `v2.5.0` confirmed; `HEAD detached at v2.5.0, nothing to commit, working tree clean` |
| Confirm frontend changes present | `grep -E "styles.css\?v=\|app.js\?v=" index.html` | `styles.css?v=2.9.7`, `app.js?v=2.9.7` — confirms the tagged commit's working tree has the actual UI changes, not just the runbook doc commit |
| Rebuild API | `cd server && npm run build` | `tsc` compiled with **zero errors**; `dist/server.js` and `dist/db/migrate.js` regenerated with fresh timestamps |
| Reload PM2 | `pm2 reload dayflow-api --update-env` | Graceful reload: `SIGINT` → HTTP connections closed → Postgres pool drained → clean reboot. `↺` restart count incremented by exactly 1 (expected). `hf-api`/`hf-web` restart counts (`204` / `6`) **unchanged** |
| Verify PM2 logs | `pm2 logs dayflow-api --lines 20 --nostream` | Confirmed: `Server running on port 5000`, Swagger docs available, `Connected directly to PostgreSQL Database`. No errors |
| Reload Nginx | `sudo nginx -t && sudo systemctl reload nginx` | `syntax is ok` / `test is successful`, reload completed silently (no errors) |

---

## 4. Post-deployment verification (runbook §5)

### 4.1 Command-line checks — all passed
- `index.html` serves `styles.css?v=2.9.7` and `app.js?v=2.9.7` ✅
- `GET /api/auth/config` → `200 OK`, correct `googleClientId` payload ✅
- `GET /docs/` → `200` ✅
- `pm2 status hf-api` / `hf-web` → both `online`, restart counts unchanged from pre-deploy baseline (`204`, `6`) — **HelpFinder4U confirmed unaffected** ✅

### 4.2 Browser smoke test — completed
The engineer completed the full browser checklist from runbook §5.2 (asset version check via DevTools Network tab, login/demo mode load with no console errors, responsive header behavior across the four breakpoints, and view-switching across Grid/Habits/Notes/Analytics/Settings) and confirmed no issues. Detailed per-breakpoint screenshots were not archived in this log — if a future audit needs that level of evidence, capture and attach screenshots per breakpoint at deploy time.

---

## 5. Deviations / issues encountered

**None required a deploy-time fix.** One cosmetic gap worth flagging back to the dev team:

- `npm run build` output showed `dayflow-server@2.4.1` — the `server/package.json` `version` field was **not bumped to `2.5.0`** as part of this release. Purely cosmetic (doesn't affect runtime), but worth fixing so `package.json` stays in sync with the git tag for future audits.

Notably, **all four runbook gaps identified during the `v2.4.1` deploy** (wrong expected table count, missing `/docs`/`/api-docs` Nginx routes, no Google OAuth origin step, undocumented Certbot file restructuring — see `DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md` §5) **did not resurface**, since this release didn't touch DB schema, Nginx config, or OAuth config. Those fixes from the previous deploy remain in place untouched.

---

## 6. Rollback

**Not invoked** — deployment succeeded on the first pass with no issues at any verification gate. Rollback procedure (runbook §6) remains: `git checkout v2.4.1` → rebuild → `pm2 reload dayflow-api` → reload Nginx, expected under 60 seconds since no migrations were involved.

---

## 7. Sign-off

```text
================================================================================
DAYFLOW PRODUCTION DEPLOYMENT SIGN-OFF: RELEASE v2.5.0
================================================================================
Deployment Date:     2026-09-27
Deployed By:         Joseph C J
Target Environment:  AWS Lightsail (13.200.154.214) / dayflowlive.com
Target Release Tag:  v2.5.0 (commit 514bd42)
Pre-Deploy Status:   All services healthy (HF & DayFlow online)
Git Checkout Tag:    v2.5.0 confirmed (git describe --tags -> v2.5.0)
API Build Status:    tsc compilation successful (dist/ generated)
PM2 Reload:          dayflow-api online, 0 errors, 1 clean restart
Nginx Reload:        sudo nginx -t passed, systemctl reload nginx completed
Asset Verification:  styles.css?v=2.9.7 & app.js?v=2.9.7 confirmed live
HelpFinder Health:   hf-web and hf-api verified 100% untouched (restart counts unchanged)
Final Status:        SUCCESS
================================================================================
```

---

## 8. Follow-up items for the dev team

1. Bump `server/package.json` `version` field to `2.5.0` (currently still reads `2.4.1`) — cosmetic, low priority.
2. Carried forward from the `v2.4.1` deployment log, **still open**: Swagger UI (`/docs`, `/api-docs`) is publicly exposed in production with no `NODE_ENV` gate or authentication — see `DEPLOYMENT_EXPERIENCE_LIGHTSAIL_LIVE.md` §7 item 1 for the recommended fix. Unrelated to this release, but still unresolved as of this deploy.
