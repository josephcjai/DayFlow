package com.dayflow.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.repository.AuthRepository
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.data.repository.TodoRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isAuthenticated: Boolean = false,
    val isDemoMode: Boolean = false,
    val userEmail: String? = null,
    val displayName: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val scheduleRepository: ScheduleRepository,
    private val habitRepository: HabitRepository,
    private val todoRepository: TodoRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        if (authRepository.isLoggedIn()) {
            _uiState.update {
                it.copy(
                    isAuthenticated = true,
                    isDemoMode = authRepository.isDemoMode()
                )
            }
        }
    }

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Email and password are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.login(email, password)
            result.fold(
                onSuccess = { user ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            isDemoMode = false,
                            userEmail = user.email,
                            displayName = user.displayName
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage ?: "Login failed"
                        )
                    }
                }
            )
        }
    }

    fun register(email: String, password: String, displayName: String) {
        if (email.isBlank() || password.isBlank() || displayName.isBlank()) {
            _uiState.update { it.copy(errorMessage = "All fields are required") }
            return
        }

        if (password.length < 6) {
            _uiState.update { it.copy(errorMessage = "Password must be at least 6 characters") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.register(email, password, displayName)
            result.fold(
                onSuccess = { user ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            isDemoMode = false,
                            userEmail = user.email,
                            displayName = user.displayName
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage ?: "Registration failed"
                        )
                    }
                }
            )
        }
    }

    fun enterDemoMode(weekStart: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            authRepository.enableDemoMode()
            // Seed local mock data for zero-friction exploration
            scheduleRepository.seedDemoSchedule(weekStart)
            habitRepository.seedDemoHabits(weekStart)
            todoRepository.seedDemoTodos(weekStart)

            _uiState.update {
                it.copy(
                    isLoading = false,
                    isAuthenticated = true,
                    isDemoMode = true,
                    displayName = "Demo Explorer",
                    userEmail = "demo@dayflowlive.com"
                )
            }
        }
    }

    fun forgotPassword(email: String) {
        if (email.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Please enter your email address") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.forgotPassword(email)
            result.fold(
                onSuccess = { msg ->
                    _uiState.update { it.copy(isLoading = false, successMessage = msg) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage ?: "Request failed"
                        )
                    }
                }
            )
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }

    fun logout() {
        authRepository.logout()
        _uiState.update {
            AuthUiState(
                isAuthenticated = false,
                isDemoMode = false
            )
        }
    }
}
