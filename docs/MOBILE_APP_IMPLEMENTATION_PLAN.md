# DayFlow Mobile App — Step-by-Step Implementation Plan

| Plan Metadata | Details |
|---|---|
| **Project** | DayFlow Native Android Mobile Client |
| **Document Purpose** | Comprehensive Phase-by-Phase Execution Plan |
| **Companion Documents** | [`MOBILE_APP_ARCHITECTURE.md`](./MOBILE_APP_ARCHITECTURE.md), [`MOBILE_APP_ONBOARDING.md`](./MOBILE_APP_ONBOARDING.md), [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) |
| **Estimated Duration** | 6 - 8 Weeks (Agile Sprints) |

---

## 1. Structural Separation Strategy (Web vs. Mobile)

To guarantee zero coupling and distinct lifecycle management:

```
DayFlow/ (Monorepo root)
├── index.html                   # Web Client Single-Page Entry
├── src/                         # Web Client Assets (JS, CSS, initialData)
├── nginx/                       # Web Client Reverse Proxy & Static Serving
├── server/                      # Node.js/Express Backend REST API
├── docs/                        # Shared Architectural & API Documentation
└── mobile/                      # ISOLATED MOBILE APP ROOT
    ├── build.gradle.kts         # Root Gradle build configuration
    ├── settings.gradle.kts      # Gradle settings & module inclusion
    └── app/                     # Android Application Module
        ├── build.gradle.kts     # App-level dependencies (Compose, Room, Hilt)
        └── src/
            ├── main/
            │   ├── AndroidManifest.xml
            │   ├── java/com/dayflow/app/
            │   │   ├── di/              # Hilt Dependency Injection Modules
            │   │   ├── domain/          # Entities, Use Cases, Business Rules
            │   │   ├── data/            # Room DB, Retrofit API, Repositories
            │   │   ├── presentation/    # Compose UI Screens, ViewModels, Themes
            │   │   ├── widget/          # Jetpack Glance Home Screen Widget
            │   │   └── worker/          # WorkManager Background Sync Workers
            │   └── res/                 # Android Icons, Drawables, Strings
            └── test/                    # Unit & Domain Logic Tests
```

### Isolation Guarantees:
1. **NPM & Web Builds:** Web builds (`docker-compose.yml`, `npm run dev`) ignore `/mobile`.
2. **Android Studio / Gradle Builds:** Gradle ignores `/src`, `/server`, and root Web files.
3. **No Direct Code Imports:** Mobile interacts with the backend strictly via HTTPS REST calls (`https://dayflowlive.com/api` or `http://10.0.2.2:5000/api`).

---

## 2. Phase-by-Phase Implementation Roadmap

### Phase 0: Workspace Scaffolding & CI Foundation
* **Goal:** Initialize isolated Android project in `/mobile`, configure Kotlin Gradle DSL, Hilt, Room, and Compose.
* **Tasks:**
  1. Scaffold `/mobile` with `build.gradle.kts`, `settings.gradle.kts`, and `app/build.gradle.kts`.
  2. Configure SDK target (`compileSdk = 35`, `minSdk = 26`, `targetSdk = 35`).
  3. Set up Kotlin 1.9+, Java 17 compatibility, and Jetpack Compose compiler.
  4. Add core libraries:
     - AndroidX Core, Lifecycle, Activity Compose, Navigation Compose
     - Material 3 & Extended Icons
     - Retrofit 2 + OkHttp 3 + Kotlinx Serialization
     - Room Database (with KSP)
     - Dagger Hilt
     - WorkManager
     - Jetpack Glance
  5. Add `.gitignore` entries for `.gradle`, `/build`, and `.idea` inside `/mobile`.
* **Deliverable:** Compilable empty Compose activity with dynamic Material 3 theme.

---

### Phase 1: Data Layer & Network Infrastructure
* **Goal:** Establish secure networking, API client, and offline-first Room persistence.
* **Tasks:**
  1. Define API models (`RegisterRequest`, `LoginResponse`, `WeekScheduleResponse`, `SlotDto`, `HabitDto`, `TodoDto`) matching [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).
  2. Implement `DayFlowApiService` Retrofit interface.
  3. Create `AuthInterceptor` with `EncryptedSharedPreferences` for Bearer token injection.
  4. Set up Room Database:
     - `ScheduleSlotEntity` + `ScheduleSlotDao`
     - `HabitLogEntity` + `HabitLogDao`
     - `TodoEntity` + `TodoDao`
     - `MutationQueueEntity` + `MutationQueueDao`
  5. Implement `ScheduleRepositoryImpl`, `HabitRepositoryImpl`, `AuthRepositoryImpl`.
* **Deliverable:** Unit tests verifying DAO CRUD operations and MockWebServer API contract handling.

---

### Phase 2: Domain Layer & Core Business Rules
* **Goal:** Implement pure Kotlin domain logic, slot key parsers, and Golden Time-Lock enforcement.
* **Tasks:**
  1. Implement `slotKey` parser and formatter:
     - Format: `YYYY-MM-DD_HH:MM` (30-minute intervals).
     - Validation: Minute is always `00` or `30`, 48 slots per day.
  2. Implement `weekKey` math:
     - ISO date of Monday (`YYYY-MM-DD`).
     - Functions to navigate between previous/current/next weeks.
  3. Implement **Golden Time-Lock Rule** Use Case:
     - `fun isSlotTimePassed(slotKey: String): Boolean`
     - When passed: `plannedTask` is immutable.
     - `actualTask`, `actualDuration`, `status`, `notes`, `category` remain editable.
  4. Implement task auto-fill rule:
     - In future/pending slots, typing `plannedTask` synchronizes `actualTask` automatically.
* **Deliverable:** 100% test coverage on `isSlotTimePassed`, `weekKey` calculation, and date validation (1800-2200 bounds).

---

### Phase 3: Authentication & Onboarding UI
* **Goal:** Deliver user authentication, secure token storage, biometric lock, and Demo Mode.
* **Tasks:**
  1. Build Auth screens in Jetpack Compose:
     - **Welcome / Landing Screen**
     - **Login Screen** (Email, Password, validation)
     - **Registration Screen** (Email, Display Name, Password)
     - **Forgot Password Sheet**
  2. Implement **Instant Demo Mode**:
     - 1-tap "Explore in Demo Mode" loads mock schedule without network request.
  3. Implement `BiometricPromptManager`:
     - Allow users to enable Fingerprint / Face Unlock for app resume.
  4. Build auto-login / session restore flow on app launch (`/api/auth/me`).
* **Deliverable:** Fully functional auth flow with offline Demo Mode capability.

---

### Phase 4: Core Schedule Grid & Task Editor (Heart of DayFlow)
* **Goal:** Build the interactive 30-minute time-blocking schedule interface.
* **Tasks:**
  1. Implement Day View (Vertical Timeline):
     - Continuous scrollable 48-slot list (`00:00` to `23:30`).
     - Visual indicators: Current time needle, slot status chips (`Done`, `Partial`, `Missed`, `Pending`).
     - Category color bars (Indigo, Sky Blue, Amber, Pink, Emerald, Purple).
  2. Implement Week View:
     - Horizontal day selector (Monday to Sunday) with task completion progress indicators.
     - Swipe gestures to transition across days and weeks.
  3. Implement **Task Editor Modal / BottomSheet**:
     - Time-Lock check: If slot time has passed, disable `plannedTask` and show *"Baseline plan locked"* badge.
     - Category picker with hex color indicators.
     - Actual duration slider/stepper (0 to 120 mins, default 30 mins).
     - Status selector (`Done`, `Partial`, `Missed`, `Pending`).
     - Execution notes text field.
* **Deliverable:** Highly responsive 30-minute schedule grid matching web app semantics with mobile-native fluidity.

---

### Phase 5: Habit Ledger & Weekly Todos
* **Goal:** Enable 1-tap habit logging and weekly todo checklist management.
* **Tasks:**
  1. Habit Ledger UI:
     - Quick 1-tap habit cards (Hydration, Workout, Deep Work, Reading).
     - Visual streak counter and daily completion badge.
     - Haptic feedback trigger on tap.
     - Delete habit log confirmation.
  2. Weekly Todo Checklist UI:
     - Todo creation input.
     - Checkbox toggle with strike-through animation.
     - Weekly markdown notes editor with preview.
  3. Sync with `/api/habits/log` and `/api/todos/*`.
* **Deliverable:** Seamless habit logging and todo checklist synchronized with local Room DB.

---

### Phase 6: Offline-First Synchronization Engine
* **Goal:** Enable zero-latency local operations with background queue sync via WorkManager.
* **Tasks:**
  1. Implement `MutationQueueManager`:
     - Enqueue pending mutations whenever an offline slot edit, habit log, or todo toggle occurs.
  2. Build `SyncWorker` (`androidx.work.CoroutineWorker`):
     - Triggered automatically on network reconnect (`NetworkType.CONNECTED`).
     - Processes queued mutations sequentially with idempotency.
     - Retries with exponential backoff on transient errors.
  3. Implement manual pull-to-refresh sync gesture on schedule grid.
* **Deliverable:** Verified full offline operation: edit slots in Airplane Mode -> reconnect -> automatic server sync.

---

### Phase 7: Mobile-Native Superpowers (Widgets & Notifications)
* **Goal:** Implement features exclusive to mobile.
* **Tasks:**
  1. **Current Slot Home Screen Widget (Jetpack Glance):**
     - Shows current active 30-min slot, task name, and category badge.
     - 1-tap "Mark as Done" action directly from home screen.
  2. **Transition Notifications:**
     - Schedule local alarm 5 minutes before current slot ends.
     - Actionable notification: *"Did you complete your 09:00 task? Tap to log."*
  3. **Haptic & Sound Design:**
     - Tactile feedback when marking tasks done or completing habits.
* **Deliverable:** Working Home Screen Glance Widget and proactive transition notifications.

---

### Phase 8: Quality Assurance, Security Audit & Release
* **Goal:** Hardening, performance profiling, and production release readiness.
* **Tasks:**
  1. Run end-to-end integration tests with local backend (`http://10.0.2.2:5000/api`).
  2. Test against Live Production backend (`https://dayflowlive.com/api`).
  3. Memory leak & layout jank profiling with Android Studio Profiler.
  4. ProGuard / R8 minification and obfuscation rules.
  5. Generate signed production AAB (Android App Bundle).
* **Deliverable:** Release-ready Android App Bundle for Google Play Console.

---

## 3. Sprint Breakdown & Milestones

| Sprint | Focus Area | Key Deliverables |
|---|---|---|
| **Sprint 1 (Week 1)** | Architecture & Scaffolding | `/mobile` module setup, Hilt, Room, Retrofit, Data DTOs |
| **Sprint 2 (Week 2)** | Domain Logic & Auth | Time-lock use cases, Login/Register UI, Demo Mode |
| **Sprint 3 (Week 3-4)** | Schedule Grid & Task Editor | 30-min timeline, Week pager, Time-locked Task Editor |
| **Sprint 4 (Week 5)** | Habits, Todos & Notes | 1-tap Habit ledger, Todo checklist, markdown sync |
| **Sprint 5 (Week 6)** | Offline Sync & WorkManager | Mutation queue, background worker, pull-to-refresh |
| **Sprint 6 (Week 7)** | Native Widget & Notifications | Jetpack Glance widget, transition alerts, haptics |
| **Sprint 7 (Week 8)** | Hardening & Store Release | Performance profiling, R8 shrinking, Signed AAB |
