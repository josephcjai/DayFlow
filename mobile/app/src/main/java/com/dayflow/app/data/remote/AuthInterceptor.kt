package com.dayflow.app.data.remote

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Inject Authorization Bearer header if token exists and not in Demo Mode
        val token = tokenManager.getToken()
        val isDemo = tokenManager.isDemoMode()

        val requestBuilder = originalRequest.newBuilder()
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")

        if (!token.isNullOrBlank() && !isDemo) {
            requestBuilder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(requestBuilder.build())

        // If 401 Unauthorized, clear stored token
        if (response.code == 401) {
            tokenManager.clearToken()
        }

        return response
    }
}
