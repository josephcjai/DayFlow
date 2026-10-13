package com.dayflow.app.data.remote

import android.content.Context
import android.os.Build
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
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
        private const val KEY_IS_DEMO = "is_demo_mode"
        private const val KEY_HABIT_PRESETS = "custom_habit_presets"
        private const val KEY_NOTE_SHEETS_PREFIX = "note_sheets_"
    }
}
