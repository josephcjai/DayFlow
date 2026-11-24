package com.dayflow.app.di

import okhttp3.OkHttpClient

object SslConfigHelper {
    fun applyDebugSslIfNeeded(builder: OkHttpClient.Builder) {
        // Strict standard TLS verification enforced in production release builds.
    }
}
