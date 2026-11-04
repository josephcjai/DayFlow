# DayFlow — Production Release & Deployment Runbook Standards

> **Purpose:** This document records all operational feedback, log-string verification standards, and queued technical improvements from the Deployment & QA teams. **Every future release and `DEPLOYMENT_vX.Y.Z_PRODUCTION.md` runbook MUST consult and satisfy this checklist before promotion.**

---

## 1. Queued Code & CLI Enhancements for Next Release (`v2.11.0+`)

### 1.1 Admin CLI: Mutually Exclusive User Authentication Breakdown
- **Origin:** `DEPLOYMENT_v2.10.0_EXECUTION_LOG.md` (§6.2 & §8.2)
- **Current Behavior:** In [`server/src/admin/cli.ts`](../server/src/admin/cli.ts), `npm run admin -- stats` queries `COUNT(*) FILTER (WHERE google_id IS NOT NULL)` and `COUNT(*) FILTER (WHERE password_hash IS NOT NULL)` independently. Users who have **both** a Google OAuth link and a password set on the same account are counted in both rows, making the sub-counts appear to sum to more than `Total Registered Users` (e.g., 3 Google + 2 Password = 5 across 4 total users).
- **Action for Next Release:** Update `handleStats()` in `server/src/admin/cli.ts` to partition users into 3 mutually exclusive buckets that always sum cleanly to `Total Registered Users`:
  - `Google-Only Users`: `WHERE google_id IS NOT NULL AND password_hash IS NULL`
  - `Password-Only Users`: `WHERE password_hash IS NOT NULL AND google_id IS NULL`
  - `Hybrid (Google + Password)`: `WHERE google_id IS NOT NULL AND password_hash IS NOT NULL`

### 1.2 Stale PM2 Error Log Cleanup (`pm2 flush`) & UUID Guard Verification
- **Origin:** `DEPLOYMENT_v2.10.0_EXECUTION_LOG.md` (§6.4 & §8.3)
- **Context:** The historical `invalid input syntax for type uuid: "1791182254274"` entry from October 5 (`v2.7.0` era) remains visible in `~/.pm2/logs/dayflow-api-error.log` on Lightsail because `pm2 reload` appends to existing log files on disk.
  - Note: Frontend optimistic ID generation in `src/js/app.js` and `src/js/habits.js` was already upgraded to `generateUUID()`, and backend routes (`habitRoutes.ts`, `todoRoutes.ts`, `categoryRoutes.ts`) validate `isValidUuid(id)` and return `400 Bad Request` prior to PostgreSQL execution.
- **Action for Next Release:**
  1. Audit any remaining `memoryStore` fallback or client temporary ID paths to ensure 100% UUID v4 usage.
  2. Include an optional pre-reload log rotation/flush step (`pm2 flush dayflow-api` after archiving old logs) in the next deployment runbook so historical pre-`v2.8.0` error lines do not obscure new release telemetry.

---

## 2. Mandatory Runbook Accuracy Standards (`DEPLOYMENT_vX.Y.Z_PRODUCTION.md`)

Whenever authoring a new production deployment runbook in `docs/`, verify that all expected command outputs match the literal strings in the codebase:

### 2.1 PM2 Boot Log Verification Strings (Step 5.6)
- **NEVER use:** `DayFlow REST API Server running on port 5000 (production)` or `PostgreSQL connection pool established` (legacy strings).
- **ALWAYS use the exact console outputs from `server/src/server.ts` and `server/src/db/db.ts`:**
  ```text
  🚀 DayFlow Express REST API running on http://localhost:5000
  ✅ Connected directly to PostgreSQL Database ('dayflow_db' on localhost:5432)!
  ```
  *(And verify that the `📖 Interactive API Docs (Swagger UI)` line is absent when `NODE_ENV=production`.)*

### 2.2 API Root (`GET /api/`) & Health (`GET /api/health`) Output Shapes (Smoke Tests 1 & 2)
- **`GET /api/`** returns `name`, `version`, `status`, `healthCheck`, and the `endpoints` object (it does **not** return a `docs` key in production).
- **`GET /api/health`** returns `status`, `database`, `service`, `version`, and `timestamp` (it does **not** return `uptime`).

### 2.3 Admin CLI (`npm run admin -- stats`) Output Shape (Smoke Test 4)
- Always copy the exact `🛡️ DAYFLOW DEVOPS & ADMINISTRATIVE CLI` banner and boxed table structure (`Database Storage Footprint`, `Total Registered Users`, `Productivity Records Ledger`) from `server/src/admin/cli.ts`.

### 2.4 Per-Item Browser Smoke Test Checklist (Smoke Test 6 & Section 9)
- Provide explicit per-item `[ ]` checkboxes and evidence/notes fields for each browser verification step in Section 9 so the deployment engineer can record individual pass/fail evidence rather than a single summary line.

---

## 3. Pre-Promotion Engineering & QA Gate Checklist

Before tagging any release (`vX.Y.Z`):
1. **Version Alignment:** Bump version across `index.html` header badge, `server/package.json`, `server/package-lock.json`, `server/src/server.ts` (`APP_VERSION`), `server/src/swagger.ts`, and `server/src/admin/cli.ts` banner.
2. **Cache-Busting Consistency:** Bump `?v=X.Y.Z` across `index.html`, `about.html`, `terms.html`, `privacy.html`, and all `src/js/*.js` module imports (verify 0 stale references via grep).
3. **Database Schema Parity:** Ensure `server/src/db/schema.sql` and `server/src/db/migrate.ts` have identical tables and columns (`schema:check`).
4. **Dependency Hygiene:** Run `npm audit --omit=dev` inside `server/` and ensure **`found 0 vulnerabilities`**.
5. **TypeScript Build:** Run `npm --prefix server run build` and verify exit code `0`.

