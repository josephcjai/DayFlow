package com.dayflow.app.data.repository

import com.dayflow.app.data.model.LoginRequest
import com.dayflow.app.data.model.RegisterRequest
import com.dayflow.app.data.model.UserDto
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton
import com.dayflow.app.data.local.DayFlowDatabase

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<UserDto>
    suspend fun register(email: String, password: String, displayName: String): Result<UserDto>
    suspend fun getCurrentUser(): Result<UserDto>
    suspend fun forgotPassword(email: String): Result<String>
    suspend fun changePassword(currentPassword: String, newPassword: String): Result<String>
    fun isLoggedIn(): Boolean
    fun isDemoMode(): Boolean
    fun enableDemoMode()
    fun logout()
}

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val database: DayFlowDatabase
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<UserDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.login(LoginRequest(email = email.trim(), password = password))
            if (response.isSuccessful && response.body() != null) {
                val authBody = response.body()!!
                tokenManager.saveToken(authBody.token)
                tokenManager.saveUserEmail(authBody.user.email)
                tokenManager.saveDisplayName(authBody.user.displayName)
                tokenManager.setDemoMode(false)
                Result.success(authBody.user)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "Login failed (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun register(
        email: String,
        password: String,
        displayName: String
    ): Result<UserDto> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.register(
                RegisterRequest(
                    email = email.trim(),
                    password = password,
                    displayName = displayName.trim()
                )
            )
            if (response.isSuccessful && response.body() != null) {
                val authBody = response.body()!!
                tokenManager.saveToken(authBody.token)
                tokenManager.saveUserEmail(authBody.user.email)
                tokenManager.saveDisplayName(authBody.user.displayName)
                tokenManager.setDemoMode(false)
                Result.success(authBody.user)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "Registration failed (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCurrentUser(): Result<UserDto> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            return@withContext Result.success(
                UserDto(
                    id = "demo-user-id",
                    email = "demo@dayflowlive.com",
                    displayName = "Demo Explorer"
                )
            )
        }

        try {
            val response = apiService.getCurrentUser()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.user)
            } else {
                Result.failure(Exception("Failed to fetch user profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun changePassword(
        currentPassword: String,
        newPassword: String
    ): Result<String> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            return@withContext Result.success("Password updated successfully (Demo Mode)")
        }
        try {
            val response = apiService.changePassword(
                com.dayflow.app.data.model.ChangePasswordRequest(
                    currentPassword = currentPassword,
                    newPassword = newPassword
                )
            )
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Password updated successfully!")
            } else {
                val errorMsg = response.errorBody()?.string() ?: "Failed to change password (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun forgotPassword(email: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.forgotPassword(com.dayflow.app.data.model.ForgotPasswordRequest(email.trim()))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.message)
            } else {
                Result.failure(Exception("Password reset request failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun isLoggedIn(): Boolean {
        return tokenManager.isDemoMode() || !tokenManager.getToken().isNullOrBlank()
    }

    override fun isDemoMode(): Boolean {
        return tokenManager.isDemoMode()
    }

    override fun enableDemoMode() {
        tokenManager.setDemoMode(true)
        tokenManager.saveUserEmail("demo@dayflowlive.com")
        tokenManager.saveDisplayName("Demo Explorer")
    }

    override fun logout() {
        tokenManager.clearToken()
        tokenManager.setDemoMode(false)
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            database.clearAllTables()
        }
    }
}
