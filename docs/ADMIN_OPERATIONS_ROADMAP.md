# 🛡️ DayFlow Administration & Operations Roadmap
## Secure Operations Architecture, Privacy Boundaries, and Administrative Tooling

**Status:** Phase 1 Active & Implemented  
**Target Milestones:** **`v2.10.0`** (Phase 1 CLI Tooling) → **`v3.0.0`** (Phase 2 Account Portal)  
**Author:** DayFlow Engineering  
**Core Design Philosophy:** Strict Privacy Isolation & Zero-Attack-Surface Operations  

---

## 1. Executive Summary & Problem Statement

DayFlow is a high-focus personal productivity application designed for individual users. Because DayFlow stores intensely personal data—daily task descriptions, habit completions, focus logs, and private markdown notes—introducing administrative capabilities requires **strict architectural boundaries**:

1. **User Trust & Privacy First:** Administrators must never have arbitrary read access to users' private journal notes, schedule tasks, or habit reflections.
2. **Minimal Attack Surface:** Exposing web-based administrative endpoints (`/api/admin/*`) on a public domain creates a high-value attack target for credential stuffing, privilege escalation, and session hijacking.
3. **Multi-App Coexistence Safety:** Administrative tooling must never impact the coexisting HelpFinder4U production application running on the shared AWS Lightsail host.

To satisfy these requirements, DayFlow adopts a **Two-Phase Administrative Architecture**.

---

## 2. Phased Roadmap Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Server-Side DevOps CLI Tooling (v2.10.0 — CURRENT)             │
│                                                                        │
│ • Runs locally on the host via SSH (`npm run admin -- <command>`)      │
│ • Zero HTTP endpoints exposed to the public internet                   │
│ • Direct PostgreSQL connection via existing secure pool                │
│ • Metadata & account actions only (NO access to note text/tasks)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Restricted Account Admin Web Portal (Future v3.0.0)           │
│                                                                        │
│ • Role-Based Access Control (`role = 'admin'` in users table)          │
│ • Mandatory Hardware/App Multi-Factor Authentication (TOTP)            │
│ • Strict Privacy Boundary: Account metadata only, zero note inspection │
│ • Append-only administrative audit log table (`admin_audit_logs`)      │
│ • Rate-limited admin routes (5 attempts / minute)                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: DevOps CLI Tooling (Implemented)

Phase 1 provides DevOps and deployment engineers with a command-line interface directly on the server host:

```bash
cd /var/www/dayflow/server
npm run admin -- <command> [arguments]
```

### Supported Commands

| Command | Arguments | Description |
|---|---|---|
| `stats` | — | Displays system-wide metrics: total registered users, auth providers, active/suspended count, total schedule slots, habit logs, todos, and categories. |
| `users` | `[limit=50]` | Formatted tabular list of registered users: ID, Email, Display Name, Auth Provider, Account Status (`ACTIVE` / `SUSPENDED`), and Registration Date. |
| `user` | `<email\|id>` | Detailed account profile and usage statistics (slots count, habit count, todos count, categories count). **Strictly omits private task text and notes.** |
| `disable` | `<email\|id>` | Suspends user account (`is_disabled = true`) and immediately revokes all active JWT sessions via `token_version` bump. |
| `enable` | `<email\|id>` | Reactivates a suspended user account (`is_disabled = false`), restoring sign-in capability. |
| `reset-password` | `<email\|id> <new-password>` | Hashes new password (10 rounds bcrypt), updates credentials, and invalidates all active sessions. |
| `delete-user` | `<email\|id> --confirm` | Permanently purges user and all associated data via PostgreSQL cascading deletion (GDPR Right to be Forgotten compliance). |

### Security & Privacy Guardrails in Phase 1
- **Zero Attack Surface:** No web endpoints or routes added. CLI is accessible only via SSH authentication.
- **Privacy Guaranteed:** The `user` inspection command returns aggregated record counts and account metadata. It does not select or dump `planned_task`, `actual_task`, `weekly_notes`, or `note_sheets`.
- **Session Revocation:** Disabling an account or resetting a password immediately increments `token_version`, instantly invalidating any issued JWT tokens across all devices.

---

## 4. Phase 2: Restricted Account Web Portal (Future Roadmap)

When organizational scaling requires non-technical support staff to manage accounts without SSH access, Phase 2 will implement an in-app administrative portal:

### Core Requirements for Phase 2:
1. **Schema Extension:**
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
   CREATE TABLE IF NOT EXISTS admin_audit_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       admin_id UUID NOT NULL REFERENCES users(id),
       target_user_id UUID REFERENCES users(id),
       action VARCHAR(50) NOT NULL,
       details JSONB NOT NULL DEFAULT '{}'::jsonb,
       ip_address VARCHAR(45),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **Mandatory Two-Factor Authentication (2FA/TOTP):**
   - Admin routes cannot be unlocked with password alone. TOTP token validation required on every administrative session.
3. **Auditing & Non-Repudiation:**
   - Every administrative lookup, suspension, or reset logged to `admin_audit_logs`.
4. **Architectural Data Firewalls:**
   - Admin role permissions explicitly block `SELECT` on note content, schedule tasks, and habit details.
