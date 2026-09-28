# DayFlow Mobile & Cross-Platform Roadmap

| Document Metadata | Details |
|---|---|
| **Document Purpose** | Single Source of Truth for Mobile & Future macOS Development Roadmap |
| **Tracking Mode** | Living Roadmap & Verification Checklist |
| **Commit Rule** | **STRICT:** Wait for user testing & verification after changes before committing any code to the repository. |
| **Target Platform Priority** | **1. Android Native (Active)** $\to$ **2. macOS / Desktop App (Future Milestone)** |

---

## 🧭 High-Level Milestones

- [ ] **Milestone 1: Android Foundation & Offline Data Engine** (In Progress)
- [ ] **Milestone 2: Android Core UX (30-Min Schedule Grid, Time-Lock, Task Modal)**
- [ ] **Milestone 3: Habits, Todo Checklist, & Background WorkManager Sync**
- [ ] **Milestone 4: Native Android Capabilities (Glance Widget, Transition Alerts, Biometrics)**
- [ ] **Milestone 5: QA Testing, Store Signing & Android Production Release**
- [ ] **Milestone 6: macOS Desktop Client (Compose Multiplatform / Swift)**

---

## 📋 Detailed Task Checklist

### Phase 0: Workspace Scaffolding & Clean Code Isolation
- [x] Create isolated `/mobile` directory structure decoupled from Web code (`/src`, `/index.html`).
- [x] Configure `settings.gradle.kts`, root `build.gradle.kts`, and `app/build.gradle.kts`.
- [x] Configure Android compileSdk 35, minSdk 26, targetSdk 35, Java 17, and Kotlin 2.0.
- [x] Add dependencies: Jetpack Compose (BOM), Material 3, Room, Retrofit, Hilt, WorkManager, Glance.
- [x] Update `.gitignore` with Android build artifacts (`.gradle/`, `build/`, `.idea/`, `local.properties`).
- [x] Create initial `MainActivity` and `DayFlowTheme` design system (matching DayFlow brand colors & categories).
- [ ] **Test Gate 0:** User verification that `/mobile` structure compiles cleanly and Web app remains untouched. (READY FOR TEST)


### Phase 1: Data Layer, API Client & Room Database
- [ ] Implement DTOs matching backend REST API contracts (`/api/auth/*`, `/api/schedule/*`, `/api/habits/*`, `/api/todos/*`).
- [ ] Implement `DayFlowApiService` Retrofit client pointing to `https://dayflowlive.com/api` (prod) and `http://10.0.2.2:5000/api` (dev emulator).
- [ ] Implement `AuthInterceptor` with `EncryptedSharedPreferences` for secure Bearer token handling.
- [ ] Set up Room Database:
  - `ScheduleSlotEntity` + `ScheduleSlotDao`
  - `HabitLogEntity` + `HabitLogDao`
  - `TodoEntity` + `TodoDao`
  - `MutationQueueEntity` + `MutationQueueDao`
- [ ] Implement repository interfaces and implementations (`ScheduleRepository`, `HabitRepository`, `AuthRepository`).
- [ ] **Test Gate 1:** User verification of local database operations and mock network interaction.

### Phase 2: Domain Layer & Golden Time-Lock Logic
- [ ] Create domain entities (`Slot`, `Habit`, `Todo`, `Category`, `SlotStatus`).
- [ ] Implement pure Kotlin `slotKey` parser (`YYYY-MM-DD_HH:MM`) and validator (30-min intervals, 48 slots/day).
- [ ] Implement `weekKey` ISO calculation (Monday-anchored `YYYY-MM-DD`).
- [ ] Implement **Golden Time-Lock Rule** use case (`isSlotTimePassed(slotKey)`):
  - When passed: `plannedTask` is locked and immutable.
  - `actualTask`, `actualDuration`, `status`, `notes`, `category` remain 100% editable.
- [ ] Unit tests for domain logic (zero Android framework dependencies for future macOS portability).
- [ ] **Test Gate 2:** User verification of time-lock and date calculation tests.

### Phase 3: Auth, Biometrics & Instant Demo Mode
- [ ] Welcome & Onboarding screen with DayFlow branding.
- [ ] Login screen (Email + Password) with form validation.
- [ ] Register screen (Email, Display Name, Password).
- [ ] **Instant Demo Mode:** 1-tap local sandbox with pre-loaded mock data (no credentials required).
- [ ] Biometric prompt (`BiometricPrompt`) for secure quick-resume.
- [ ] **Test Gate 3:** User testing of login, registration, and Demo Mode flow.

### Phase 4: Core 30-Minute Schedule Grid & Task Modal
- [ ] Day View: Vertical scrollable timeline of 48 slots (`00:00` to `23:30`).
- [ ] Slot card rendering: Category color bar, planned task, actual task, duration badge, status indicator (`Done`, `Partial`, `Missed`, `Pending`).
- [ ] Current time line indicator.
- [ ] Week navigation bar (Monday through Sunday) with day completion progress.
- [ ] **Task Editor Modal / BottomSheet:**
  - Automatic time-lock detection: If slot time has passed, disable `plannedTask` input and show *"Baseline plan locked"* badge.
  - Category dropdown with color chips.
  - Duration picker/stepper.
  - Status toggle buttons.
- [ ] **Test Gate 4:** User testing of grid interactions, editing future slots vs. editing past slots.

### Phase 5: Habits Ledger & Weekly Todos
- [ ] 1-Tap Habit Logging cards with tactile haptic feedback.
- [ ] Streak calculation and daily goal indicator.
- [ ] Weekly Todo checklist with strikethrough animation.
- [ ] Weekly markdown notes editor.
- [ ] **Test Gate 5:** User testing of habit logging, streak display, and todo toggles.

### Phase 6: Offline-First Synchronization & Background Workers
- [ ] Optimistic UI updates with zero-latency local mutations.
- [ ] Offline `MutationQueueEntity` to capture pending changes.
- [ ] `SyncWorker` implementation using `WorkManager` with `NetworkType.CONNECTED` constraint.
- [ ] Exponential backoff retry policies.
- [ ] Pull-to-refresh on schedule screen.
- [ ] **Test Gate 6:** User testing of airplane mode changes syncing to server upon reconnecting.

### Phase 7: Mobile-Native Integrations
- [ ] Jetpack Glance Home Screen Widget showing current 30-min slot + 1-tap "Done" button.
- [ ] Transition alert notifications scheduled 5 minutes before slot completion.
- [ ] Haptic feedback tuning for common interactions.
- [ ] **Test Gate 7:** User testing of widget and notification behavior on device/emulator.

### Phase 8: Production Release & Store Preparation
- [ ] End-to-end testing against live production backend (`https://dayflowlive.com/api`).
- [ ] Memory and battery profiling.
- [ ] ProGuard / R8 rules configuration.
- [ ] Signed Android App Bundle (AAB) generation.
- [ ] **Test Gate 8:** Final user sign-off for Google Play Store release.

---

## 🖥️ Future macOS Expansion (Milestone 6)

*Note: Scheduled after Android release.*

- [ ] Extract the pure Kotlin `domain` module into a shared multiplatform module (`commonMain`).
- [ ] Evaluate UI strategy: **Compose Multiplatform for Desktop (macOS)** vs. native Swift/AppKit UI consuming Kotlin Multiplatform shared core.
- [ ] macOS Menubar App: Fast menu-bar icon showing the current 30-minute block and quick task logging.
- [ ] Native macOS notifications for slot transitions.
