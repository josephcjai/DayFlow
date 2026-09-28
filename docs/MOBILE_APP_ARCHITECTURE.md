# DayFlow Mobile App — Architecture Specification
## Target: Android Native (Kotlin & Jetpack Compose) / Clean Architecture

| Document Metadata | Details |
|---|---|
| **Author** | DayFlow Engineering Team |
| **Document Version** | `1.0.0` |
| **Status** | Approved Specification |
| **Companion Documents** | [`MOBILE_APP_ONBOARDING.md`](./MOBILE_APP_ONBOARDING.md), [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md), [`MOBILE_APP_IMPLEMENTATION_PLAN.md`](./MOBILE_APP_IMPLEMENTATION_PLAN.md) |

---

## 1. System Context & Separation of Concerns

DayFlow consists of three distinct platforms operating around a centralized REST API service. A primary engineering requirement is the **strict decoupling and physical separation between Web client code and Mobile app code**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DAYFLOW BACKEND SERVER                             │
│       Node.js (TypeScript) + Express + PostgreSQL 16 (v2.5.0 REST API)      │
│                     Production: https://dayflowlive.com/api                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                        REST / HTTPS JSON (Bearer JWT)
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                 │
┌─────────────▼───────────────┐                 ┌───────────────▼─────────────┐
│      DAYFLOW WEB CLIENT     │                 │     DAYFLOW MOBILE APP      │
│  Directory: /src, /index.html│                 │      Directory: /mobile     │
│  - Vanilla JS / CSS         │                 │  - Kotlin / Jetpack Compose │
│  - Browser DOM & SPA        │                 │  - Android SDK / Material 3 │
│  - LocalStorage / Memory    │                 │  - Room DB (Offline-First)  │
│  - Nginx Static Hosting     │                 │  - WorkManager / Glance     │
└─────────────────────────────┘                 └─────────────────────────────┘
```

### 1.1 Web vs. Mobile Separation Rules

To prevent coupling and maintain clear developer boundaries:
1. **Independent Directories & Build Systems:**
   - Web application assets remain strictly in `/src`, `/nginx`, and `/index.html`.
   - Mobile application code is strictly contained within `/mobile` (e.g., `/mobile/android` or standalone repository `DayFlow-Android`).
   - Web build tools (`npm`, `docker`, `nginx`) and Mobile build systems (`gradle`, Android SDK, `build.gradle.kts`) never intermix or share dependencies.
2. **Shared Contract through API Only:**
   - Neither client imports or shares raw source files from the other.
   - The REST API specification (`docs/API_DOCUMENTATION.md`) serves as the single immutable contract between backend, web, and mobile.
3. **Independent Storage Strategies:**
   - Web uses browser `localStorage` and dynamic DOM state.
   - Mobile uses an **Offline-First Room SQLite Database** with reactive `Flow` streams, background `WorkManager` synchronization, and `EncryptedSharedPreferences`.

---

## 2. Mobile Clean Architecture & Layered Design

The DayFlow mobile app follows Android's recommended **Clean Architecture** with a reactive **MVI / MVVM (Model-View-ViewModel / Model-View-Intent)** presentation layer.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│  ┌────────────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │    Jetpack Compose     │  │  Jetpack Glance │  │  Android System  │  │
│  │ Screens, Dialogs, Bars │  │ AppWidget (Slot)│  │  Notifications   │  │
│  └───────────▲────────────┘  └────────▲────────┘  └────────▲─────────┘  │
│              │                        │                    │            │
│              └────────────────────────┼────────────────────┘            │
│                                       │ (StateFlow / Events)            │
│                              ┌────────┴────────┐                        │
│                              │   ViewModels    │                        │
│                              └────────▲────────┘                        │
└───────────────────────────────────────┼─────────────────────────────────┘
                                        │
┌───────────────────────────────────────┼─────────────────────────────────┐
│                              DOMAIN LAYER                               │
│  ┌────────────────────────────────────┴──────────────────────────────┐  │
│  │ Use Cases / Interactors:                                          │  │
│  │ - GetCurrentWeekScheduleUseCase   - SyncPendingMutationsUseCase   │  │
│  │ - SaveSlotUseCase (with Time-Lock) - CheckSlotLockStatusUseCase   │  │
│  │ - LogHabitUseCase                 - ToggleTodoUseCase             │  │
│  │ Domain Entities & Enums: Slot, Habit, Todo, Category, SlotStatus  │  │
│  │ Pure Business Rules: slotKey & weekKey math, isSlotTimePassed     │  │
│  └────────────────────────────────────▲──────────────────────────────┘  │
└───────────────────────────────────────┼─────────────────────────────────┘
                                        │
┌───────────────────────────────────────┼─────────────────────────────────┐
│                               DATA LAYER                                │
│  ┌────────────────────────────────────┴──────────────────────────────┐  │
│  │ Repositories (SSOT): ScheduleRepository, HabitRepository, Auth    │  │
│  └────────────────────▲──────────────────────────────▲───────────────┘  │
│                       │                              │                  │
│       ┌───────────────┴───────────────┐  ┌───────────┴────────────┐     │
│       │       LOCAL DATA SOURCE       │  │   REMOTE DATA SOURCE   │     │
│       │ Room Database (SQLite)        │  │ Retrofit 2 + OkHttp3   │     │
│       │ - SlotEntity, HabitEntity     │  │ - DayFlowApiService    │     │
│       │ - MutationQueueEntity (Sync)  │  │ - Bearer Token Interc. │     │
│       │ EncryptedSharedPreferences    │  │ - Exponential Backoff  │     │
│       └───────────────────────────────┘  └────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Domain Rules & Business Logic

### 3.1 Time-Lock & Immutability Rules
The core business requirement of DayFlow is the **Golden Time-Lock Rule**:
* **Slot Structure:** Exactly 30-minute intervals. 48 slots per day (`00:00` to `23:30`).
* **Format:** `YYYY-MM-DD_HH:MM` (e.g., `2026-09-28_09:30`).
* **Rule Logic:**
  ```kotlin
  fun isSlotTimePassed(slotKey: String): Boolean {
      val (dateStr, timeStr) = slotKey.split("_")
      val slotDateTime = LocalDateTime.parse("${dateStr}T${timeStr}:00")
      return LocalDateTime.now().isAfter(slotDateTime)
  }
  ```
* **Guard in Presentation/Domain:**
  - If `isSlotTimePassed(slotKey) == true`:
    - `plannedTask` field in Task Editor dialog is **disabled/read-only** with a warning badge: *"Baseline plan locked"*.
    - `actualTask`, `actual_duration`, `status`, `notes`, and `category` remain **100% editable**.
  - If `isSlotTimePassed(slotKey) == false`:
    - Both `plannedTask` and `actualTask` are fully editable.
    - Updating `plannedTask` automatically updates `actualTask` if `actualTask` was unchanged or blank.

### 3.2 Week Calculation Standard
* All weekly data is anchored to the Monday of the week (`weekKey` = `YYYY-MM-DD`).
* DayFlow uses `DayOfWeek.MONDAY` as day 1 through `DayOfWeek.SUNDAY` as day 7.

### 3.3 Domain Categories & Palette
Tasks and habits strictly map to the standardized color tokens:
* `Learning` → Hex `#6366F1` (Indigo)
* `Work` → Hex `#0284C7` (Sky Blue)
* `Household` → Hex `#D97706` (Amber)
* `Family` → Hex `#DB2777` (Pink)
* `Health` → Hex `#059669` (Emerald)
* `Travel` → Hex `#7C3AED` (Purple)

---

## 4. Offline-First Architecture & Data Synchronization

The mobile app must function seamlessly with intermittent or zero internet connectivity.

```
       User Action (Edit Slot / Log Habit / Toggle Todo)
                            │
                            ▼
               Save to Room Database (SSOT)
              (Status: PENDING_SYNC or SYNCS_OK)
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    UI Updates Reactively          Enqueues Mutation to
    via Kotlin Flow (0ms lag)      MutationQueueEntity
                                            │
                                            ▼
                                   WorkManager SyncWorker
                                   (Triggers if Online)
                                            │
                                   POST /api/schedule/slot
                                            │
                       ┌────────────────────┴────────────────────┐
                       ▼                                         ▼
                 [200 OK Response]                         [Network Error]
           Update Room DB SlotEntity                  Keep in MutationQueue
           Remove from MutationQueue                  WorkManager Retries with
                                                      Exponential Backoff
```

### 4.1 Room Database Entities
1. `ScheduleSlotEntity`: Contains `slotKey`, `weekStart`, `dayOfWeek`, `slotTime`, `plannedTask`, `actualTask`, `category`, `plannedDuration`, `actualDuration`, `status`, `notes`, `isSyncPending`, `updatedAt`.
2. `HabitLogEntity`: Contains `id`, `habitName`, `logTime`, `category`, `pointsImpact`, `notes`, `isSyncPending`.
3. `TodoEntity`: Contains `id`, `weekStart`, `title`, `isCompleted`, `isSyncPending`.
4. `MutationQueueEntity`: Stores serialized HTTP payload, endpoint URL, HTTP method, and retry attempt count.

### 4.2 Sync Strategies
- **Immediate Sync:** When network is available, repository triggers a lightweight Coroutine network dispatch.
- **Background Sync (`WorkManager`):** Periodic worker (`PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)`) with `NetworkType.CONNECTED` constraints guarantees changes sync even if app was killed.
- **Conflict Resolution:** Client-side timestamp precedence (`updatedAt` ISO string).

---

## 5. Security & Authentication Architecture

1. **Token Persistence:**
   - JWT tokens are stored using Android's `EncryptedSharedPreferences` backed by the **Android Keystore System** (AES-256-GCM).
2. **Network Interceptor:**
   - An `OkHttp` `AuthInterceptor` injects `Authorization: Bearer <jwt_token>` into every request.
   - An `Authenticator` or 401 handler triggers automatic session cleanup and prompts for re-authentication.
3. **Biometric Authentication:**
   - Integrates `androidx.biometric.BiometricPrompt` for Fingerprint / Face Unlock when returning to the app from background.
4. **Demo Mode (Guest Architecture):**
   - A `DemoModeRepository` implementation provides pre-populated mock schedules, habits, and notes entirely offline without calling backend auth endpoints. Allows instant guest exploration and smooth Google Play Store review.

---

## 6. Mobile-Specific Native Integrations

1. **Current Slot Home Screen Widget (Jetpack Glance):**
   - Displays current 30-minute block (e.g., `09:30 - 10:00`), current scheduled task, category badge, and 1-tap "Mark Done" action.
2. **Transition Reminders (Local Notifications):**
   - Scheduled via `AlarmManager` to ring 5 minutes before slot end (e.g., at `09:25`, `09:55`), prompting the user: *"Did you finish your 09:00 slot? Tap to log actual execution."*
3. **Haptic Feedback:**
   - Subtle vibrations (`HapticFeedbackType.LongPress` / `TextHandleMove`) on completing slots or checking habits.

---

## 7. Technology Stack Summary

| Component | Selected Technology | Rationale |
|---|---|---|
| **Language** | Kotlin `1.9+` | Modern, null-safe, official standard for Android |
| **UI Framework** | Jetpack Compose + Material 3 | Declarative, dynamic theming, rapid prototyping |
| **Architecture** | Clean Architecture (MVVM/MVI) | Robust separation, testability, predictable state |
| **Local Database** | Room SQLite | Single source of truth, reactive Flow support |
| **Networking** | Retrofit 2 + OkHttp 3 + Kotlinx Serialization | Industry standard, robust interceptor support |
| **DI Engine** | Dagger Hilt | Seamless Android lifecycle injection |
| **Background Sync** | AndroidX WorkManager | Battery-conscious, guaranteed execution |
| **Widgets** | Jetpack Glance | Modern Compose-based app widget framework |
| **Secure Storage** | EncryptedSharedPreferences | Keystore-backed AES-GCM token storage |
| **Asynchronous** | Kotlin Coroutines & Flow | Non-blocking reactive programming |
