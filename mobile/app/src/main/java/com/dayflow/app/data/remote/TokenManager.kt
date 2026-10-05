package com.dayflow.app.data.remote

import android.content.Context
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

    companion object {
        private const val PREFS_FILENAME = "encrypted_dayflow_prefs"
        private const val FALLBACK_PREFS = "dayflow_dev_prefs"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_DISPLAY_NAME = "display_name"
        private const val KEY_IS_DEMO = "is_demo_mode"
    }
}
