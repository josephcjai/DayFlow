# DayFlow — Real Production Deployment Log (dayflowlive.com)

**Date:** 2026-09-22
**Deployed by:** Joseph C J
**Target:** AWS Lightsail `13.200.154.214`, coexisting with an existing app ("HelpFinder4U")
**Domain:** `dayflowlive.com` (purchased via GoDaddy, deployed same day)
**Release:** `v2.4.1`
**Companion doc:** [`DEPLOYMENT_LIGHTSAIL.md`](./DEPLOYMENT_LIGHTSAIL.md) — the original planning/runbook doc. This file records what actually happened when that runbook was executed for real: the deviations, the mistakes, the gaps in the runbook itself, and the fixes. Read both together; treat this one as the "known issues + lessons learned" companion.

> This doc intentionally contains **no real secrets** (passwords, API keys, JWT secrets). Where a real value was used during deployment, it's redacted here — see the server's `/var/www/dayflow/server/.env` (permissions `600`) for the live values.

---

## 1. Decisions made before starting

These were explicit choices, not defaults from the runbook — recorded here so future deploys don't have to re-decide them:

| Decision | Choice made | Reasoning |
|---|---|---|
| Domain structure | Root domain `dayflowlive.com` + `www.dayflowlive.com`, **not** `app.dayflowlive.com` subdomain | Simpler; no plan for a separate marketing site on the root domain |
| API routing | Path-based (`dayflowlive.com/api/*` via Nginx reverse proxy) | Matches the runbook's Option A/B pattern. Deliberately **not** mirroring HelpFinder4U's separate `api.` subdomain pattern — avoids an extra DNS record, extra Nginx server block, and extra SSL cert for no real benefit on a single-frontend app |
| Code ref to deploy | Git tag `v2.4.1`, not `main` tip | Gives a fixed rollback point (`git checkout <previous-tag>`) if a future deploy breaks something. At deploy time `main` and `v2.4.1` were identical, but tagging discipline was adopted going forward |
| Execution mode | User ran all commands themselves via their own SSH session; Claude gave commands and interpreted output/screenshots | No SSH credentials were shared with or used by the assistant |

---

## 2. GoDaddy DNS setup — what was actually needed

The runbook assumes DNS is being configured from scratch. In practice, GoDaddy's domain already had default records. **Only one change was required:**

- Existing `A` record for `@` pointed to GoDaddy's "WebsiteBuilder Site" (default parking). **Edited** its value to `13.200.154.214`.
- An existing `CNAME` record `www → dayflowlive.com.` was already present and required **no change** — it automatically follows the root once `@` resolves correctly.
- Left untouched: `NS` records, `SOA`, `CNAME _domainconnect` (GoDaddy's own domain-connect feature), `TXT _dmarc`.

**Lesson:** Don't assume a "fresh" DNS setup — always inspect the existing record table first (`Domain → DNS`) rather than blindly adding new records; GoDaddy often pre-populates records that only need editing, not duplicating.

Propagation was fast in this case — resolved globally in well under the "up to an hour" estimate, confirmed via `nslookup dayflowlive.com`.

---

## 3. Database setup — a real mistake and its fix

### Mistake 1: Used the literal placeholder password
The runbook's example SQL uses `'YourSecureDbPasswordHere123!'` as a placeholder. It was pasted verbatim (including the placeholder) into `psql` instead of being substituted with a real secret first.

**Fix applied:**
```sql
ALTER USER dayflow_user WITH ENCRYPTED PASSWORD '<new real password>';
```
No need to drop/recreate the user — `ALTER USER` rotates the password in place.

**Lesson for next time:** Generate and note the real DB password *before* opening `psql`, not while inside the SQL block. Never leave a documented example password unedited.

### Mistake 2: Multi-line paste into `psql` silently broke `\c`
Pasting the entire SQL block (`CREATE USER...` through `ALTER DEFAULT PRIVILEGES...`) as one clipboard paste caused the terminal to eat a line break. The `\c dayflow_db` command merged with the next line's tokens and failed:
```
invalid integer value "ON" for connection option "port"
Previous connection kept
```
Because `\c` failed, the psql session **stayed connected to the `postgres` database**, and the subsequent `GRANT ALL ON SCHEMA public...` / `ALTER DEFAULT PRIVILEGES...` statements silently ran against the wrong database. The prompt (`postgres=#` vs `dayflow_db=#`) was the only visible clue.

**Fix applied:** Re-ran `\c dayflow_db` **alone**, confirmed the prompt changed to `dayflow_db=#`, then re-ran the three grant statements one at a time.

**Lesson for next time:** Inside interactive REPLs like `psql`, never paste multiple commands as one block — paste (or type) one statement at a time and **verify the prompt/response after each one**, especially after any `\c` (connect) command. This class of bug is easy to miss because every individual command reports success — the only symptom is the wrong database context.

---

## 4. Terminal paste reliability — recurring friction point

Pasting multi-line text into `nano` and into interactive prompts was unreliable in this session's terminal (repeatedly got stuck with no visible way to exit, or lines merged unexpectedly). This cost significant back-and-forth.

**What worked reliably instead: bash heredocs**, e.g.:
```bash
cat > /var/www/dayflow/server/.env << 'EOF'
...file contents...
EOF
```
A heredoc is far more paste-tolerant than an interactive editor or REPL, because bash just accumulates lines until it sees the literal `EOF` delimiter — it doesn't matter if the paste event breaks in a weird place internally, as long as the delimiter line survives intact.

**Recommendation for future deploys:** Prefer heredocs (`cat > file << 'EOF' ... EOF` or `sudo tee file > /dev/null << 'EOF' ... EOF`) over `nano`/`vi` for writing any multi-line config or env file over SSH, unless doing a small targeted edit to an existing file (in which case `nano` + `Ctrl+W` to search is fine for single-line edits).

**If stuck inside `nano` and `Ctrl+X` doesn't respond:** click directly inside the terminal pane first (not the title bar) to ensure it has keyboard focus, then retry. As an absolute last resort, closing the terminal window and reconnecting via SSH is safe as long as nothing important was unsaved.

---

## 5. Deployment doc (runbook) gaps found during real execution

These are corrections/gaps in `DEPLOYMENT_LIGHTSAIL.md` itself, discovered only by actually running it:

### 5.1 Expected table count is wrong
The runbook says migrations create 7 tables including a `todos` table. The actual `server/src/db/schema.sql` only defines **6** tables: `users`, `schedule_weeks`, `schedule_slots`, `habit_logs`, `todo_items`, `password_reset_tokens`. There is no separate `todos` table — it was folded into `todo_items` at some point after the runbook was written. **Action item:** update the runbook's checklist to match the real schema.

### 5.2 Nginx config is missing routes for Swagger docs
The runbook's Nginx `location /api/` block only proxies paths with the exact `/api/` prefix. But the backend serves Swagger UI at **`/docs`** and **`/api-docs`** (see `server.ts:63`), neither of which starts with `/api/`. Result: visiting `https://<domain>/api-docs` silently fell through to the SPA's `try_files ... /index.html` and rendered the DayFlow login screen instead of Swagger UI — no error, just the wrong page, which made it easy to miss.

**Fix applied** — added two more `location` blocks to `dayflow.conf`, before `location /api/`:
```nginx
location /docs {
    proxy_pass http://127.0.0.1:5000/docs;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api-docs {
    proxy_pass http://127.0.0.1:5000/api-docs;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
**Action item:** add this to the runbook's canonical Nginx config so future deploys don't hit the same silent-fallthrough bug.

### 5.3 Runbook has no mention of Google OAuth origin configuration
The runbook lists "Google OAuth 2.0 Client ID (if enabling Google Sign-In)" as a credential to have ready, but never mentions that the **Authorized JavaScript origins** on that OAuth Client ID (in Google Cloud Console → APIs & Services → Credentials) must include the production domain. Without it, Google Sign-In fails at the browser level with:
```
Access blocked: Authorisation error
Error 400: origin_mismatch
```
**Fix applied:** added `https://dayflowlive.com` and `https://www.dayflowlive.com` to the OAuth client's Authorized JavaScript origins.
**Action item:** add this as an explicit runbook step whenever the domain changes (new domain, new subdomain, or moving off `localhost`).

### 5.4 Certbot restructures the Nginx file — know the resulting shape
The runbook's Nginx example is a single `server {}` block on port 80, expecting Certbot to "just add SSL." In practice, `certbot --nginx` rewrote the file into **two** server blocks:
- The original block becomes the **port 443** block (with `listen 443 ssl;` and the cert directives appended at the end of it) and keeps all the original `location` blocks.
- A **new second block** is added for port 80, containing only `if ($host = ...) return 301 https://...` redirect logic and a final `listen 80; ... return 404;` catch-all.

This matters because any future manual edit to add a `location` block **must go in the first (443) block**, not the second — the second block never serves real content. This tripped up the initial attempt at fixing 5.2 above (see §4 for the workaround used: heredoc-rewriting the whole file with the fix in the right place, after `cat`-inspecting the real post-Certbot structure first).

---

## 6. Verified working end state (as of 2026-09-22)

- ✅ DNS: `dayflowlive.com` and `www.dayflowlive.com` → `13.200.154.214`
- ✅ Isolated Postgres DB/user (`dayflow_db` / `dayflow_user`), confirmed `helpfinder_db` untouched
- ✅ Code deployed from tag `v2.4.1` to `/var/www/dayflow`
- ✅ `.env` configured, permissions `600`, no leftover placeholder values (`grep -c "REPLACE_WITH\|your_actual\|your_verified\|your_google" .env` → `0`)
- ✅ Migrations ran clean, 6 tables confirmed present
- ✅ PM2: `dayflow-api` running alongside untouched `hf-api` / `hf-web` (all `online`)
- ✅ Nginx: isolated `dayflow.conf`, HTTP→HTTPS redirect (`301`) working, HelpFinder's Nginx config never touched
- ✅ SSL: valid Let's Encrypt cert via Certbot, auto-renewal scheduled, expires 2026-12-21
- ✅ `/api/*` reverse proxy working (`/api/auth/config` → `200`)
- ✅ `/docs` and `/api-docs` Swagger UI working (after the fix in §5.2)
- ✅ HelpFinder4U (`localhost:3000`, `hf-api`, `hf-web`) verified unaffected at every stage

## 7. Open follow-up items (not yet applied)

1. **Swagger UI is publicly exposed with no auth gate in production.** `server.ts:63` mounts `/docs` and `/api-docs` unconditionally — no `NODE_ENV` check, no Basic Auth. This hands anyone the full API surface (all endpoint paths, request/response schemas) and a live "Try it out" console against production. Recommended fix (not yet applied as of this writing): only mount Swagger when `!isProd`, or protect the two paths with HTTP Basic Auth at the Nginx layer if occasional production access is still wanted. See conversation/PR history for the exact one-line code change proposed.
2. Runbook (`DEPLOYMENT_LIGHTSAIL.md`) should be updated per §5.1–5.4 above so the next deploy (or a different engineer) doesn't rediscover the same gaps.
3. Consider whether `google-auth-library`'s `EBADENGINE` warning (wants Node ≥22, server runs Node `v20.20.1`) needs a Node upgrade — no functional issue observed yet, but worth revisiting if Google Sign-In behaves unexpectedly in the future.

---

## 8. Useful command patterns learned this session

**Write a multi-line file reliably over SSH (avoids paste/nano issues):**
```bash
cat > /path/to/file << 'EOF'
...contents...
EOF
```
or, when root privileges are needed to write the file:
```bash
sudo tee /path/to/file > /dev/null << 'EOF'
...contents...
EOF
```

**Verify no placeholder values were left in a secrets file, without exposing the real values:**
```bash
grep -c "REPLACE_WITH\|your_actual\|your_verified\|your_google" /path/to/.env
```
(Should print `0`.)

**Check just the variable *names* in an env file (not values) before/after editing:**
```bash
cat /path/to/.env | cut -d= -f1
```

**Confirm which database a `psql` session is actually connected to** — always check the prompt itself (`dbname=#`), never assume a `\c` succeeded silently.

**Exit `pm2 logs` tailing** (does not stop the underlying process — it's just a log viewer): `Ctrl+C`.
