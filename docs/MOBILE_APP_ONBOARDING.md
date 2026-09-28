# DayFlow — Mobile App Development Onboarding & Architecture Guide
## Context, Business Rules, API Contracts, and Best Practices for Mobile Engineering

| Document Metadata | Details |
|---|---|
| **Document Purpose** | Developer Onboarding & Architecture Specification for Mobile App Team |
| **Target Platform** | Android (Native Kotlin/Compose or Cross-Platform Flutter/React Native) |
| **Backend API Version** | DayFlow REST API `v2.5.0` |
| **Live Production API** | `https://dayflowlive.com/api` |
| **Local Dev API** | `http://localhost:5000/api` (or `http://10.0.2.2:5000/api` in Android Emulator) |
| **Target Audience** | Mobile Tech Lead, Android Developers, QA Mobile Engineers |

---

## 1. Executive Summary & Product Identity

**DayFlow** is a focus-driven daily scheduler, habit enforcement ledger, and productivity tracker. It replaces cumbersome, static spreadsheet schedules with an intuitive, real-time 30-minute time-blocking application featuring baseline planning, actual execution tracking, and category analytics.

### Why Users Love DayFlow:
1. **Granular 30-Minute Time-Blocking:** Breaks the day into manageable 30-minute intervals from early morning to night.
2. **Explicit Planned vs. Actual Tracking:** Users plan their week in advance, and then log what they *actually* accomplished in real time.
3. **The "Baseline Time-Lock" Philosophy:** Promotes discipline. Once a 30-minute slot's scheduled time has passed, the planned task is locked as an immutable historical record, while actual execution, duration, and completion status remain flexible.
4. **Frictionless Habit Tracking:** 1-tap logging for daily routines (hydration, workouts, deep work blocks) with gamified productivity points.
5. **Weekly Focus Analytics:** Immediate visualization of planned vs. actual hours across defined categories (Learning, Work, Health, etc.).

---

## 2. System Architecture & Context

The backend REST API and web application are already built, tested, and running in production. The mobile app will act as a client consuming the existing REST API.

```
┌────────────────────────────────────────────────────────┐
│                   DAYFLOW BACKEND                      │
│  Node.js (TypeScript) + Express + PostgreSQL 16 DB      │
│  Hosted at: https://dayflowlive.com/api                │
└───────────────────────────▲────────────────────────────┘
                            │
              REST / HTTPS  │  JWT Bearer Auth
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
┌────────┴────────┐                  ┌─────────┴─────────┐
│  WEB CLIENT     │                  │  NEW MOBILE APP   │
│  (Production)   │                  │  (Android / iOS)  │
│  Desktop/Mobile │                  │  Kotlin Compose   │
│  Responsive     │                  │  Offline-First    │
└─────────────────┘                  └───────────────────┘
```

---

## 3. Core Domain Rules & Business Logic (CRITICAL)

The mobile development team must enforce the following core domain rules in mobile UI/UX and local state logic:

### 3.1 Slot Key Format (`slotKey`)
* A schedule slot is identified by a unique key formatted as:
  ```text
  YYYY-MM-DD_HH:MM
  ```
  *Examples:* `2026-09-28_09:00`, `2026-09-28_11:30`, `2026-09-28_14:00`.
* **Slots are strictly 30 minutes in length.** Minute component is always `00` or `30`.
* A 24-hour day contains **48 slots** (from `00:00` to `23:30`).

### 3.2 Week Key Convention (`weekKey`)
* Weeks in DayFlow **always start on Monday** and end on Sunday.
* The `weekKey` is the ISO date (`YYYY-MM-DD`) of the Monday for that week.
  *Example:* For Wednesday, September 30, 2026, the `weekKey` is `2026-09-28`.
* All schedule slots, habits, and weekly notes are grouped under their corresponding `weekKey`.

### 3.3 The Golden Time-Lock Rule (Core Value Proposition)
DayFlow differentiates between **Planned Task** (intent) and **Actual Task** (execution):
* **Before a slot starts:** The user can edit both `plannedTask` and `actualTask`.
* **Once a slot's scheduled time has passed:**
  - `plannedTask` becomes **LOCKED / READ-ONLY** (displays baseline locked message: *"Baseline plan locked"*). Users cannot alter past plans.
  - `actualTask`, `actual` duration (mins), `status`, `notes`, and `category` remain **100% editable at any time**.
* *Rule implementation in mobile:* Calculate `isSlotTimePassed(slotKey)`:
  ```kotlin
  fun isSlotTimePassed(slotKey: String): Boolean {
      // Parse slotKey "YYYY-MM-DD_HH:MM" into a LocalDateTime
      // Return true if slotStartDateTime < LocalDateTime.now()
  }
  ```

### 3.4 Slot Statuses & Priority Points
Slots have 4 standard completion states:
1. **`Done` (Completed):** Actual task finished on schedule.
2. **`Partial` (Partially Done):** Started or partially completed.
3. **`Missed` (Incomplete):** Did not complete planned task.
4. **`Pending` (Upcoming/In-Progress):** Default state for future or unlogged slots.

### 3.5 Categories & Themes
Tasks belong to defined productivity categories:
* `Learning` (Color: Indigo / `#6366f1`)
* `Work` (Color: Sky Blue / `#0284c7`)
* `Household` (Color: Amber / `#d97706`)
* `Family` (Color: Pink / `#db2777`)
* `Health` (Color: Emerald / `#059669`)
* `Travel` (Color: Purple / `#7c3aed`)

---

## 4. REST API Overview & Endpoints

### 4.1 Authentication & Security
* **Authentication Header:** All protected endpoints require standard Bearer token:
  ```http
  Authorization: Bearer <jwt_token>
  Content-Type: application/json
  ```
* **Base URL:**
  - Production: `https://dayflowlive.com/api`
  - Local Dev Server: `http://localhost:5000/api`
  - Android Emulator: `http://10.0.2.2:5000/api` (Points to host localhost)

### 4.2 Key Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|:---:|:---|:---|:---:|
| `POST` | `/api/auth/register` | Register with email, password, displayName | No |
| `POST` | `/api/auth/login` | Login with email and password -> returns JWT token | No |
| `POST` | `/api/auth/google` | Google Sign-In with Google ID token | No |
| `GET` | `/api/auth/me` | Fetch active user profile | **Yes** |
| `POST` | `/api/auth/forgot-password` | Request password reset email | No |
| `GET` | `/api/schedule/week/:weekStart` | Fetch full week schedule slots, habits, and notes | **Yes** |
| `POST` | `/api/schedule/slot` | Save or update a 30-min schedule slot | **Yes** |
| `DELETE` | `/api/schedule/slot` | Clear/delete a schedule slot | **Yes** |
| `POST` | `/api/habits/log` | Log a completed habit entry | **Yes** |
| `DELETE` | `/api/habits/:id` | Delete a habit log entry | **Yes** |
| `GET` | `/api/todos/week/:weekStart` | Fetch weekly todos and notes | **Yes** |
| `POST` | `/api/todos/todo` | Create new todo item | **Yes** |
| `PATCH` | `/api/todos/:id` | Update todo (toggle completed, edit text) | **Yes** |
| `DELETE` | `/api/todos/:id` | Delete a todo item | **Yes** |
| `POST` | `/api/todos/notes` | Save markdown notes for the week | **Yes** |
| `GET` | `/api/health` | Health check endpoint | No |

*Full request and response schemas are documented in [`docs/API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).*

---

## 5. Strict DO's and DON'Ts for Mobile Development

### ✅ DO's (Best Practices)
1. **DO Adopt Offline-First Architecture:**
   - Mobile users frequently check and log tasks with spotty connectivity.
   - Use a local database (e.g. Room DB in Kotlin or SQLite) as the single source of truth for the UI.
   - Sync local mutations with the backend via background workers (`WorkManager`).
2. **DO Strictly Enforce the Time-Lock Rule in UI:**
   - When opening the task editor modal for a past slot, disable the `Planned Task` input and show the locked badge: *"Baseline plan locked"*.
   - Keep `Actual Task`, `Actual Duration`, `Status`, and `Notes` completely editable.
3. **DO Use Monday-Based Week Keys:**
   - Always calculate `weekStart` as the Monday of the relevant week (`YYYY-MM-DD`). Never use Sunday.
4. **DO Support Instant "Demo Mode":**
   - The web app has a seamless 1-tap "Explore in Demo Mode" feature that loads mock local data without requiring credentials. Provide this on mobile for quick app store review and guest onboarding.
5. **DO Capitalize on Native Mobile Capabilities:**
   - **Current Slot Widget:** Build an Android Home Screen Widget showing the current 30-minute block and what task is scheduled *NOW*.
   - **Transition Notifications:** Schedule local notifications 5 minutes before a slot ends to remind the user to log actual execution.
   - **Haptics:** Provide gentle haptic feedback when toggling todos or logging habits.
   - **Biometrics:** Offer Fingerprint / Face Unlock for instant access without retyping passwords.
6. **DO Sanitize and Validate Dates:**
   - Enforce ISO format `YYYY-MM-DD` between `1800-01-01` and `2200-12-31`.

---

### ❌ DON'Ts (Anti-Patterns to Avoid)
1. **DON'T Allow Modifying `plannedTask` on Past Slots:**
   - Never allow users to retroactively change what they planned to do yesterday or earlier today. Baseline planning integrity is fundamental to DayFlow.
2. **DON'T Perform Network Calls on the Main Thread:**
   - Always run network and database queries asynchronously (Coroutines / Flow in Kotlin, async/await).
3. **DON'T Rely Exclusively on Real-Time Internet Connectivity:**
   - A user should be able to open DayFlow on an airplane, view their schedule, and log tasks. Queued mutations should sync when connectivity returns.
4. **DON'T Modify Backend Schema or Invent Custom Endpoints:**
   - Consume the existing REST API contracts as defined. If a new endpoint is needed, collaborate with the backend team.
5. **DON'T Store Plaintext Tokens:**
   - Store JWT tokens and sensitive credentials securely using Android's `EncryptedSharedPreferences` or Keystore.
6. **DON'T Use Ad-Hoc Timestamps:**
   - Never send epoch milliseconds where ISO date strings (`YYYY-MM-DD`) are expected. Follow the API contract precisely.

---

## 6. Recommended Android Architecture

For an Android-first implementation, we strongly recommend:

* **Language:** Kotlin (100%)
* **UI Framework:** **Jetpack Compose** (Modern declarative UI, Material 3 theming)
* **Architecture Pattern:** MVVM / MVI with Clean Architecture (UI -> ViewModel -> Repository -> Local DB / Remote API)
* **Local Persistence:** **Room Database** (with Kotlin Coroutines & Flow)
* **Networking:** **Retrofit 2** or **Ktor Client** with Kotlinx Serialization
* **Dependency Injection:** **Hilt**
* **Background Sync:** **WorkManager** (Periodic sync and retry policies)
* **Home Screen Widget:** **Jetpack Glance** (Declarative widgets with Compose syntax)

---

## 7. Step-by-Step Onboarding Checklist for the Mobile Team

1. [ ] **Clone Repository:**
   ```bash
   git clone https://github.com/josephcjai/DayFlow.git
   ```
2. [ ] **Review Reference Documentation:**
   - Read [`docs/TECHNICAL_SPECIFICATION.md`](./TECHNICAL_SPECIFICATION.md) (Architecture overview).
   - Read [`docs/API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) (Full endpoint request/response payloads).
   - Read [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) (PostgreSQL entity structures).
3. [ ] **Test the Live Production Web App:**
   - Visit [`https://dayflowlive.com`](https://dayflowlive.com) to experience the user flow, 30-minute grid interaction, habit logging, and notes editor.
4. [ ] **Verify API Access:**
   ```bash
   # Test public health endpoint
   curl -I https://dayflowlive.com/api/health

   # Test auth config
   curl -s https://dayflowlive.com/api/auth/config
   ```
5. [ ] **Initialize Android Project:**
   - Scaffold the new Android project repository (e.g. `DayFlow-Android` or within a `mobile/` directory).
   - Configure Retrofit client pointing to `https://dayflowlive.com/api`.
6. [ ] **Implement Core Authentication Flow:**
   - Login, Register, Token Storage (EncryptedSharedPreferences), and Auto-Login check.
7. [ ] **Implement Schedule Grid & Time-Lock Logic:**
   - 30-min slot timeline, Day / Week views, and the read-only time-lock guard for past slots.
8. [ ] **Implement Habit Ledger & Notes Module:**
   - Rapid 1-tap logging and weekly checklist sync.
9. [ ] **Add Native Mobile Features:**
   - Android Widget (Glance), transition notifications, and biometric auth.

---

*This document is maintained by the DayFlow Engineering Team. For questions or API adjustments, reach out via the project issue tracker.*
