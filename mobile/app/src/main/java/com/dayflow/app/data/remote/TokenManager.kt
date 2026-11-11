package com.dayflow.app.data.remote

import android.content.Context
import android.os.Build
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Singleton

@Singleton
open class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context?
) {
    private val prefs: SharedPreferences by lazy {
        val ctx = context ?: throw IllegalStateException("Context required for SharedPreferences")
        val isEmulator = Build.FINGERPRINT.startsWith("generic") ||
                Build.FINGERPRINT.startsWith("unknown") ||
                Build.MODEL.contains("google_sdk") ||
                Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for x86") ||
                Build.HARDWARE.contains("goldfish") ||
                Build.HARDWARE.contains("ranchu") ||
                Build.PRODUCT.contains("sdk")

        if (com.dayflow.app.BuildConfig.DEBUG || isEmulator) {
            return@lazy ctx.getSharedPreferences(FALLBACK_PREFS, Context.MODE_PRIVATE)
        }

        try {
            val masterKey = MasterKey.Builder(ctx)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                ctx,
                PREFS_FILENAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback for emulators or devices without Keystore support in dev
            ctx.getSharedPreferences(FALLBACK_PREFS, Context.MODE_PRIVATE)
        }
    }

    open fun saveToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    open fun getToken(): String? {
        return prefs.getString(KEY_TOKEN, null)
    }

    open fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    open fun saveUserEmail(email: String) {
        prefs.edit().putString(KEY_USER_EMAIL, email).apply()
    }

    open fun getUserEmail(): String? {
        return prefs.getString(KEY_USER_EMAIL, null)
    }

    open fun saveDisplayName(name: String) {
        prefs.edit().putString(KEY_DISPLAY_NAME, name).apply()
    }

    open fun saveHasPassword(hasPassword: Boolean) {
        prefs.edit().putBoolean(KEY_HAS_PASSWORD, hasPassword).apply()
    }

    open fun hasPassword(): Boolean {
        return prefs.getBoolean(KEY_HAS_PASSWORD, true)
    }

    open fun getDisplayName(): String? {
        return prefs.getString(KEY_DISPLAY_NAME, null)
    }

    open fun setDemoMode(isDemo: Boolean) {
        prefs.edit().putBoolean(KEY_IS_DEMO, isDemo).apply()
    }

    open fun isDemoMode(): Boolean {
        return prefs.getBoolean(KEY_IS_DEMO, false)
    }


    // Notification & Suppression Preferences (v2.9.0 Alignment)
    open fun isNotificationsEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_ENABLED, true)
    }

    open fun setNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_ENABLED, enabled).apply()
    }

    open fun isActiveWindowEnabled(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_ACTIVE_WINDOW, true)
    }

    open fun setActiveWindowEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_ACTIVE_WINDOW, enabled).apply()
    }

    open fun getNotifyStartHour(): Int {
        return prefs.getInt(KEY_NOTIF_START_HOUR, 8)
    }

    open fun setNotifyStartHour(hour: Int) {
        prefs.edit().putInt(KEY_NOTIF_START_HOUR, hour).apply()
    }

    open fun getNotifyEndHour(): Int {
        return prefs.getInt(KEY_NOTIF_END_HOUR, 22)
    }

    open fun setNotifyEndHour(hour: Int) {
        prefs.edit().putInt(KEY_NOTIF_END_HOUR, hour).apply()
    }

    open fun isMuteWeekends(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_MUTE_WEEKENDS, false)
    }

    open fun setMuteWeekends(mute: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_MUTE_WEEKENDS, mute).apply()
    }

    open fun isOnlyProductive(): Boolean {
        return prefs.getBoolean(KEY_NOTIF_ONLY_PRODUCTIVE, false)
    }

    open fun setOnlyProductive(onlyProductive: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIF_ONLY_PRODUCTIVE, onlyProductive).apply()
    }

    open fun getQuietHoursMode(): String {
        return prefs.getString(KEY_NOTIF_QUIET_MODE, "full") ?: "full"
    }

    open fun setQuietHoursMode(mode: String) {
        prefs.edit().putString(KEY_NOTIF_QUIET_MODE, mode).apply()
    }


    open fun getCustomHabitPresetsJson(): String? {
        return prefs.getString(KEY_HABIT_PRESETS, null)
    }

    open fun saveCustomHabitPresetsJson(json: String) {
        prefs.edit().putString(KEY_HABIT_PRESETS, json).apply()
    }

    open fun getNoteSheetsJson(weekStart: String): String? {
        return prefs.getString(KEY_NOTE_SHEETS_PREFIX + weekStart, null)
    }

    open fun saveNoteSheetsJson(weekStart: String, json: String) {
        prefs.edit().putString(KEY_NOTE_SHEETS_PREFIX + weekStart, json).apply()
    }

    companion object {
        private const val KEY_NOTIF_ENABLED = "notif_enabled"
        private const val KEY_NOTIF_ACTIVE_WINDOW = "notif_active_window"
        private const val KEY_NOTIF_START_HOUR = "notif_start_hour"
        private const val KEY_NOTIF_END_HOUR = "notif_end_hour"
        private const val KEY_NOTIF_MUTE_WEEKENDS = "notif_mute_weekends"
        private const val KEY_NOTIF_ONLY_PRODUCTIVE = "notif_only_productive"
        private const val KEY_NOTIF_QUIET_MODE = "notif_quiet_mode"

        private const val PREFS_FILENAME = "encrypted_dayflow_prefs"
        private const val FALLBACK_PREFS = "dayflow_dev_prefs"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_DISPLAY_NAME = "display_name"
        private const val KEY_HAS_PASSWORD = "has_password"
        private const val KEY_IS_DEMO = "is_demo_mode"
        private const val KEY_HABIT_PRESETS = "custom_habit_presets"
        private const val KEY_NOTE_SHEETS_PREFIX = "note_sheets_"
        private const val KEY_TIME_FORMAT = "key_time_format"
        private const val KEY_BIOMETRICS_ENABLED = "key_biometrics_enabled"
        private const val KEY_DAILY_POINTS_TARGET = "daily_points_target"
        private const val KEY_TIMELINE_START_HOUR = "timeline_start_hour"
        private const val KEY_TIMELINE_END_HOUR = "timeline_end_hour"
        private const val KEY_ANALYTICS_EXPANDED = "key_analytics_expanded"
        private const val KEY_THEME_MODE = "key_theme_mode"
    }

    private val _themeModeFlow = MutableStateFlow(if (context != null) (prefs.getString(KEY_THEME_MODE, "dark") ?: "dark") else "dark")
    open val themeModeFlow: StateFlow<String> = _themeModeFlow.asStateFlow()

    open fun getThemeMode(): String {
        return _themeModeFlow.value
    }

    open fun setThemeMode(mode: String) {
        if (context != null) prefs.edit().putString(KEY_THEME_MODE, mode).apply()
        _themeModeFlow.value = mode
    }

    private val _timeFormatFlow = MutableStateFlow(if (context != null) (prefs.getString(KEY_TIME_FORMAT, "12h") ?: "12h") else "12h")
    open val timeFormatFlow: StateFlow<String> = _timeFormatFlow.asStateFlow()

    open fun getTimeFormat(): String {
        return _timeFormatFlow.value
    }

    open fun setTimeFormat(format: String) {
        if (context != null) prefs.edit().putString(KEY_TIME_FORMAT, format).apply()
        _timeFormatFlow.value = format
    }

    open fun isAnalyticsExpanded(): Boolean {
        return if (context != null) prefs.getBoolean(KEY_ANALYTICS_EXPANDED, false) else false
    }

    open fun setAnalyticsExpanded(expanded: Boolean) {
        if (context != null) prefs.edit().putBoolean(KEY_ANALYTICS_EXPANDED, expanded).apply()
    }

    open fun isBiometricsEnabled(): Boolean {
        return if (context != null) prefs.getBoolean(KEY_BIOMETRICS_ENABLED, false) else false
    }

    open fun setBiometricsEnabled(enabled: Boolean) {
        if (context != null) prefs.edit().putBoolean(KEY_BIOMETRICS_ENABLED, enabled).apply()
    }

    private val _dailyPointsTargetFlow = MutableStateFlow(if (context != null) prefs.getInt(KEY_DAILY_POINTS_TARGET, 50) else 50)
    open val dailyPointsTargetFlow: StateFlow<Int> = _dailyPointsTargetFlow.asStateFlow()

    open fun getDailyPointsTarget(): Int {
        return _dailyPointsTargetFlow.value
    }

    open fun setDailyPointsTarget(target: Int) {
        val clamped = target.coerceIn(10, 500)
        if (context != null) prefs.edit().putInt(KEY_DAILY_POINTS_TARGET, clamped).apply()
        _dailyPointsTargetFlow.value = clamped
    }

    private val _timelineStartHourFlow = MutableStateFlow(if (context != null) prefs.getInt(KEY_TIMELINE_START_HOUR, 0) else 0)
    open val timelineStartHourFlow: StateFlow<Int> = _timelineStartHourFlow.asStateFlow()

    private val _timelineEndHourFlow = MutableStateFlow(if (context != null) prefs.getInt(KEY_TIMELINE_END_HOUR, 23) else 23)
    open val timelineEndHourFlow: StateFlow<Int> = _timelineEndHourFlow.asStateFlow()

    open fun getTimelineStartHour(): Int {
        return _timelineStartHourFlow.value
    }

    open fun getTimelineEndHour(): Int {
        return _timelineEndHourFlow.value
    }

    open fun setTimelineWindow(startHour: Int, endHour: Int) {
        val clampedStart = startHour.coerceIn(0, 23)
        val clampedEnd = endHour.coerceIn(clampedStart, 23)
        if (context != null) {
            prefs.edit()
                .putInt(KEY_TIMELINE_START_HOUR, clampedStart)
                .putInt(KEY_TIMELINE_END_HOUR, clampedEnd)
                .apply()
        }
        _timelineStartHourFlow.value = clampedStart
        _timelineEndHourFlow.value = clampedEnd
    }

}
