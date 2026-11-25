# DayFlow Mobile — Google Play Store Release & Upload Guide (v1.0.0)

> **Document Version:** 1.0.0  
> **Prepared:** November 24, 2026  
> **Application ID:** `com.dayflowapp.mobile`  
> **Version Code / Version Name:** `1` / `"1.0.0"`  
> **Target / Min SDK:** `targetSdk = 35` (Android 15) / `minSdk = 26` (Android 8.0)  
> **Production Backend URL:** `https://dayflowlive.com/api/`

---

## 1. Key Files & Build Artifacts Reference

All mobile production build files, signing configurations, and generated artifacts reside under `c:\githubrepo\myrepos\DayFlow-Mobile\mobile`:

| File / Artifact | Absolute Path | Git Status | Purpose |
| :--- | :--- | :--- | :--- |
| **Play Store App Bundle (`.aab`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\build\outputs\bundle\release\app-release.aab` | Ignored (`*.aab`) | **Upload this file to Google Play Console** (~15.88 MB, signed with `dayflow_release`). |
| **Signed Release APK (`.apk`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\build\outputs\apk\release\app-release.apk` | Ignored (`*.apk`) | Direct-installable production APK (~16.36 MB) for physical device & QA Phase 4 testing. |
| **Production Upload Keystore** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\release-key.jks` | Ignored (`*.jks`) | RSA 2048-bit Java Keystore used to sign all Play Store uploads. **Back up securely offline!** |
| **Keystore Credentials** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\key.properties` | Ignored (`**/key.properties`) | Local signing properties read by `mobile/app/build.gradle.kts`. |
| **Keystore Template** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\key.properties.example` | Tracked | Safe example template committed to Git. |
| **Gradle Build Config** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\build.gradle.kts` | Tracked | Defines `versionCode`, `versionName`, `signingConfigs.release`, and `BuildConfig.API_BASE_URL`. |
| **Production Manifest** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\src\main\AndroidManifest.xml` | Tracked | Enforces HTTPS-only traffic in production and declares app permissions/receivers. |
| **Debug-Only Manifest** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\src\debug\AndroidManifest.xml` | Tracked | Enables cleartext traffic strictly for local emulator debugging. |
| **Release TLS Config** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\src\release\java\com\dayflowapp\mobile\di\SslConfigHelper.kt` | Tracked | Enforces strict standard X.509 TLS verification in release builds (no debug trust managers in release DEX). |
| **Play Store App Icon (`512×512`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\ic_launcher-web.png` | Tracked | High-res `512×512` PNG app icon exported from adaptive icon vectors (`10.5 KB`). |
| **Play Store Feature Graphic (`1024×500`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\feature-graphic-1024x500.png` | Tracked | `1024×500` PNG Play Store top banner graphic (`84.2 KB`). |
| **Phone Screenshot 1 (`1080×2400`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\01-schedule-timeline.png` | Tracked | Real `Pixel_6` capture: 30-Minute Schedule Timeline (`259.3 KB`). |
| **Phone Screenshot 2 (`1080×2400`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\02-daily-focus-analytics.png` | Tracked | Real `Pixel_6` capture: Daily Focus Analytics & 7-Day Consistency (`195.9 KB`). |
| **Phone Screenshot 3 (`1080×2400`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\03-habits-tracker.png` | Tracked | Real `Pixel_6` capture: Habits Tracker & Daily Discipline Goal (`196.1 KB`). |
| **Phone Screenshot 4 (`1080×2400`)** | `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\04-settings-theme-selector.png` | Tracked | Real `Pixel_6` capture: Settings & 4-Theme Live Selector (`211.4 KB`). |

---

## 2. Production Keystore & Signing Details

> ⚠️ **CRITICAL BACKUP REQUIREMENT:** Store a copy of `mobile/release-key.jks` and `mobile/key.properties` in a secure password vault (e.g., 1Password / Bitwarden / offline encrypted backup). Every future update to `com.dayflowapp.mobile` on Google Play must be signed with this exact `dayflow_release` upload key.

- **Keystore Location:** `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\release-key.jks`
- **Key Alias:** `dayflow_release`
- **Key Algorithm / Size / Validity:** `RSA` / `2048-bit` / `10,000 days` (Valid until ~2054)
- **Certificate Distinguished Name (DN):** `CN=DayFlow Mobile, OU=Engineering, O=DayFlow, L=Bengaluru, ST=KA, C=IN`
- **Certificate Fingerprints:**
  - **SHA-1:** `3B:82:3A:10:25:30:6A:71:21:74:95:29:07:36:C4:E7:1D:6E:87:33`
  - **SHA-256:** `12:AC:C8:89:D2:50:40:4A:E7:CF:D0:05:1B:CE:81:DA:14:5C:C0:7B:49:2E:0E:3A:39:75:0D:2C:BB:89:32:94`

### How to Rebuild or Verify Signed Artifacts Anytime

```powershell
cd c:\githubrepo\myrepos\DayFlow-Mobile\mobile

# 1. Build signed Google Play App Bundle (.aab) and signed APK (.apk)
.\gradlew.bat bundleRelease assembleRelease

# 2. Verify cryptographic signature on the Play Store bundle
& "C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe" -verify -verbose -certs "app\build\outputs\bundle\release\app-release.aab"
```

---

## 3. Google Cloud Console OAuth 2.0 Setup (Google Sign-In)

DayFlow uses **Android Credential Manager** (`GetGoogleIdOption`) for native 1-tap Google Sign-In. All OAuth credentials live under Google Cloud Project **`1033021313424`**:
👉 https://console.cloud.google.com/apis/credentials?project=1033021313424

### 3.1 Registered OAuth 2.0 Client IDs
1. **`DayFlow Web Client`** (*Web application*):
   - **Client ID:** `1033021313424-jm6ke98n03tjl3ti7gndk10fv2pphq8p.apps.googleusercontent.com`
   - Used as `GOOGLE_SERVER_CLIENT_ID` in `DayFlowApiService.kt` and verified by the Node.js backend (`POST /api/auth/google`).
2. **`DayFlow Android`** (*Android — Debug Key*):
   - **Package name:** `com.dayflowapp.mobile`
   - **Purpose:** Authorizes Google Sign-In on local debug/emulator builds (`~/.android/debug.keystore`).
3. **`DayFlow Android (Production Release)`** (*Android — Release Upload Key*):
   - **Package name:** `com.dayflowapp.mobile`
   - **SHA-1:** `3B:82:3A:10:25:30:6A:71:21:74:95:29:07:36:C4:E7:1D:6E:87:33`
   - **Purpose:** Authorizes Google Sign-In on builds signed directly with `release-key.jks` (`app-release.apk` and upload testing).

### 3.2 Mandatory Post-Upload Step: Register Google Play App Signing's SHA-1
When you upload `app-release.aab` to Google Play Console, Google Play re-signs the app delivered to end users with Google's own **App Signing Key**:
1. In **Google Play Console**, open **Test and release → Setup → App signing** (or **Release → Setup → App integrity → App signing**).
2. Under **App signing key certificate**, copy the **SHA-1 certificate fingerprint**.
3. Open https://console.cloud.google.com/apis/credentials?project=1033021313424.
4. Click **`+ CREATE CREDENTIALS` → `OAuth client ID` → `Android`**:
   - **Name:** `DayFlow Android (Google Play Store Signing Key)`
   - **Package name:** `com.dayflowapp.mobile`
   - **SHA-1 certificate fingerprint:** *(Paste the App signing key SHA-1 from Google Play Console)*
5. Click **CREATE**. *(No app rebuild is needed—Google Play Services picks this up automatically.)*

---

## 4. Step-by-Step Google Play Console Setup

### Step 4.1: Create the App in Google Play Console
1. Sign in to https://play.google.com/console.
2. Click **Create app** (top right) and enter:
   - **App name:** `DayFlow — 30-Min Timeblock & Habit Tracker` (or `DayFlow`)
   - **Default language:** `English (United States) – en-US`
   - **App or game:** `App`
   - **Free or paid:** `Free`
3. Check the **Developer Program Policies** and **US export laws** declarations and click **Create app**.

---

### Step 4.2: Complete "App Content" Policy Declarations
In the left sidebar of Google Play Console, go to **Policy and programs → App content** (or follow the dashboard tasks under **Set up your app**) and complete each card with the values below:

#### 1. Privacy Policy
- **Privacy Policy URL:**
  ```text
  https://dayflowlive.com/privacy.html
  ```

#### 2. App Access (Login Credentials for Google Play Reviewers)
- Select: **All or some functionality in my app is restricted**
- Click **Add instructions**:
  - **Instruction name:** `Standard Email & Password Login`
  - **Username / Email:** *(Provide a dedicated reviewer test account on `https://dayflowlive.com`, e.g., `playreview@dayflowlive.com`)*
  - **Password:** *(Provide the password for that test account)*
  - **Additional instructions:**
    ```text
    Sign in on the initial screen using the provided email and password to access the full 30-minute schedule grid, day templates, habits tracker, and markdown notes. Do not delete this reviewer account during testing.
    ```

#### 3. Ads
- Select: **No, my app does not contain ads**

#### 4. Content Rating (IARC Questionnaire)
- Click **Start questionnaire**:
  - **Email address:** Your contact email
  - **Category:** **All other app types** (Utility, Productivity, Communication, or other)
  - Answer **No** to all questions regarding violence, sexuality, profanity, controlled substances, public user-to-user social sharing, or cash gambling.
  - Submit the rating (assigns **Everyone / PEGI 3 / USK 0**).

#### 5. Target Audience and Content
- **Target age groups:** Check **`13-15`**, **`16-17`**, and **`18 and over`** (Do **not** select under 13, as the app is a productivity tool not designed for children and does not need Families Policy review).
- **Could your store listing unintentionally appeal to children?** Select **No**.

#### 6. Data Safety Form (Exact Answers)
- **Does your app collect or share any of the required user data types?** → **Yes**
- **Is all of the user data collected by your app encrypted in transit?** → **Yes** (All traffic uses HTTPS `https://dayflowlive.com/api/`)
- **Do you provide a way for users to request that their data is deleted?** → **Yes**
  - **Delete account URL:**
    ```text
    https://dayflowlive.com/privacy.html
    ```
  - *(Note: In-app account deletion is also built directly into **Settings → Account & App Security → Delete Account**).*
- **Data Types Collected:**
  | Category | Data Type | Collected / Shared | Optional / Required | Purpose |
  | :--- | :--- | :--- | :--- | :--- |
  | **Personal info** | **Name** (Display Name) | Collected only (Not shared) | Required for account creation | App functionality, Account management |
  | **Personal info** | **Email address** | Collected only (Not shared) | Required for account creation | App functionality, Account management |
  | **App activity** | **Other user-generated content** (Schedule slots, habits, todos, notes) | Collected only (Not shared) | Optional (user-entered) | App functionality |

#### 7. Sensitive Permissions & APIs (`SCHEDULE_EXACT_ALARM`)
Because [`AndroidManifest.xml`](../mobile/app/src/main/AndroidManifest.xml#L11) declares `android.permission.SCHEDULE_EXACT_ALARM` for 30-minute slot boundary notifications (`SlotNotificationScheduler` / `SlotAlertReceiver`), Play Console may prompt for a declaration:
- **Core functionality category:** Select **Calendar / Reminder / Time-Block Scheduling**
- **Justification text:**
  ```text
  DayFlow is a 30-minute time-block schedule and daily routine planner. The app schedules exact alarms 5 minutes before the end of an active 30-minute time slot (e.g., 09:25 for a 09:00–09:30 focus block) via SlotNotificationScheduler so users receive time-critical boundary reminders to log task completion and transition to their next scheduled block.
  ```

#### 8. Remaining Declarations
- **News apps:** `No, my app is not a news app`
- **COVID-19 contact tracing and status apps:** `My app is not a publicly available COVID-19 contact tracing or status app`
- **Advertising ID:** `No` (DayFlow does not include or use `com.google.android.gms.permission.AD_ID`)
- **Government apps:** `No`
- **Financial features:** `My app doesn't provide any financial features`
- **Health apps:** `My app does not provide any health features`

---

### Step 4.3: Complete Main Store Listing
In the left sidebar, go to **Grow users → Store presence → Main store listing**:

- **App name:** `DayFlow — 30-Min Timeblock Planner`
- **Short description (up to 80 chars):**
  ```text
  Master your day in 30-min focus blocks with habits, templates & markdown notes.
  ```
- **Full description:**
  ```text
  DayFlow is an offline-first 30-minute time-block planner, habit tracker, and markdown scratchpad designed for focused daily execution and seamless cloud sync with dayflowlive.com.

  KEY FEATURES:
  • 30-Minute Schedule Timeline: Plan and track your day in 30-minute increments with custom active-hour windows (Full 24h, Workday 8–18, Waking 6–22), category filters, and bulk slot actions.
  • Day Templates & Blueprints: Capture your best days as reusable blueprints or customize starter templates with a strict 30-minute grid editor.
  • Daily Focus Analytics: Real-time day and week completion scores, productive-hour tracking, and 7-day consistency trends.
  • Habits & Discipline Goals: Track positive and negative habits against a customizable daily points target with streak insights.
  • Weekly Todos & Multi-Sheet Markdown Notes: Manage prioritized weekly tasks, schedule todos directly onto your timeline, and write formatted markdown notes with live preview.
  • 4 Dynamic Aesthetic Themes: Choose between Deep Midnight, pure OLED Black, Emerald Forest, and Clean Light.
  • Offline-First & Cloud Sync: Works seamlessly offline with automatic background mutation syncing and JSON backup/restore.
  ```
- **Graphics Required (Ready in `mobile/playstore-assets/`):**
  - **App icon (`512 × 512 px` PNG, `10.5 KB`):**
    `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\ic_launcher-web.png`
  - **Feature graphic (`1024 × 500 px` PNG, `84.2 KB`):**
    `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\feature-graphic-1024x500.png`
  - **Phone screenshots (4 real `1080 × 2400 px` PNG captures from `Pixel_6`):**
    1. `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\01-schedule-timeline.png` *(Schedule Timeline)*
    2. `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\02-daily-focus-analytics.png` *(Daily Focus Analytics)*
    3. `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\03-habits-tracker.png` *(Habits Tracker)*
    4. `c:\githubrepo\myrepos\DayFlow-Mobile\mobile\playstore-assets\04-settings-theme-selector.png` *(Settings / Theme Selector)*

---

### Step 4.4: Upload `app-release.aab` & Publish Release

1. In the left sidebar, navigate to **Test and release → Testing → Internal testing** (recommended first for immediate 5-minute verification) or **Test and release → Production**.
2. Click **Create new release** (top right).
3. **Play App Signing:** If prompted on your first release, click **Continue** to let Google Play manage your app signing key.
   - *Immediately after this step, visit **Setup → App signing**, copy the **App signing key certificate SHA-1**, and register it in Google Cloud Console as described in [Section 3.2](#32-mandatory-post-upload-step-register-google-play-app-signings-sha-1).*
4. Under **App bundles**, click **Upload** and select:
   ```text
   c:\githubrepo\myrepos\DayFlow-Mobile\mobile\app\build\outputs\bundle\release\app-release.aab
   ```
5. Verify Play Console displays:
   - **Version code:** `1` (`1.0.0`)
   - **Target SDK:** `35`
6. Under **Release details → Release name**, leave as `1 (1.0.0)` and paste the **Release notes**:
   ```xml
   <en-US>
   Initial production release of DayFlow Mobile (v1.0.0):
   • 30-minute time-block schedule timeline with Day & Week Focus Analytics
   • Reusable Day Templates & Blueprint Editor
   • Habits discipline tracker and Weekly Todos with Multi-Sheet Markdown Notes
   • 4 themes (Deep Midnight, OLED Black, Emerald Forest, Clean Light)
   • Offline-first SQLite storage with real-time cloud sync to dayflowlive.com
   </en-US>
   ```
7. Click **Next** → review any warnings → click **Save** and **Start rollout**.

---

## 5. Future Version Updates Procedure (`v1.0.1+`)

Whenever releasing a new update to Google Play:
1. Open [`mobile/app/build.gradle.kts`](../mobile/app/build.gradle.kts#L28-L29) and increment **`versionCode`** (Google Play requires `versionCode` to strictly increase on every upload) and update **`versionName`**:
   ```kotlin
   versionCode = 2
   versionName = "1.0.1"
   ```
2. Run the unit tests and build the signed bundle:
   ```powershell
   cd c:\githubrepo\myrepos\DayFlow-Mobile\mobile
   .\gradlew.bat testDebugUnitTest bundleRelease
   ```
3. Upload the newly generated `mobile/app/build/outputs/bundle/release/app-release.aab` to Google Play Console.

---

## 6. Post-Build & Pre-Store Rollout Smoke Test Checklist

Use this checklist when verifying the signed production build (`app-release.apk` or Play Store Internal Track install) against `https://dayflowlive.com/api/`:

| # | Verification Area | Action / Step | Expected Result | Status | Evidence / Notes |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | **Production API Connectivity** | Launch `app-release.apk` and sign in with an existing `dayflowlive.com` email/password account | Authenticates via `https://dayflowlive.com/api/auth/login` and loads user's live cloud schedule | `[ ]` | |
| 2 | **Google 1-Tap Sign-In** | Tap **Sign in with Google** on the Auth screen | Google Credential Manager sheet opens and logs into `dayflowlive.com` without error | `[ ]` | |
| 3 | **Schedule Slot Sync & Clear** | Create a 30-min task, pull-to-refresh, then clear the slot and pull-to-refresh again | Slot persists on creation and remains deleted after refresh (`DELETE /api/schedule/slot` with `weekStart`) | `[ ]` | |
| 4 | **Day Templates & Blueprint Editor** | Open **Templates**, edit a blueprint's 30-min slots, save, and apply to a day | Blueprint saves to cloud and applies only to empty slots (Least Priority Rule) | `[ ]` | |
| 5 | **Theme Engine Parity** | Open **Settings** and switch across Deep Midnight, OLED Black, Emerald Forest, and Clean Light | Entire app UI and system bars update immediately and persist across app restart | `[ ]` | |
| 6 | **Biometric App Lock** | Enable **Biometric App Lock** in Settings, tap **Lock** in top header, and unlock | Quick-Resume Lock Overlay appears and unlocks via device biometrics/credential | `[ ]` | |
| 7 | **Account Deletion Compliance** | Register a disposable test account, go to **Settings → Delete Account**, and confirm | Account is deleted server-side (`DELETE /api/auth/account`), local DB wiped, and re-login rejected | `[ ]` | |
