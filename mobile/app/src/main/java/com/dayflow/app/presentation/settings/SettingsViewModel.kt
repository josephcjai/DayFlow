package com.dayflow.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.domain.model.CategoryItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val notificationsEnabled: Boolean = true,
    val activeWindowEnabled: Boolean = true,
    val startHour: Int = 8,
    val endHour: Int = 22,
    val muteWeekends: Boolean = false,
    val onlyProductive: Boolean = false,
    val categories: List<CategoryItem> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    private val categoryRepository: CategoryRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            notificationsEnabled = tokenManager.isNotificationsEnabled(),
            activeWindowEnabled = tokenManager.isActiveWindowEnabled(),
            startHour = tokenManager.getNotifyStartHour(),
            endHour = tokenManager.getNotifyEndHour(),
            muteWeekends = tokenManager.isMuteWeekends(),
            onlyProductive = tokenManager.isOnlyProductive()
        )
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        categoryRepository.getCategories()
            .onEach { categoriesList ->
                _uiState.value = _uiState.value.copy(categories = categoriesList)
            }
            .launchIn(viewModelScope)

        viewModelScope.launch {
            categoryRepository.refreshCategories()
        }
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        tokenManager.setNotificationsEnabled(enabled)
        _uiState.value = _uiState.value.copy(notificationsEnabled = enabled)
    }

    fun setActiveWindowEnabled(enabled: Boolean) {
        tokenManager.setActiveWindowEnabled(enabled)
        _uiState.value = _uiState.value.copy(activeWindowEnabled = enabled)
    }

    fun setHours(start: Int, end: Int) {
        tokenManager.setNotifyStartHour(start)
        tokenManager.setNotifyEndHour(end)
        _uiState.value = _uiState.value.copy(startHour = start, endHour = end)
    }

    fun setMuteWeekends(mute: Boolean) {
        tokenManager.setMuteWeekends(mute)
        _uiState.value = _uiState.value.copy(muteWeekends = mute)
    }

    fun setOnlyProductive(onlyProductive: Boolean) {
        tokenManager.setOnlyProductive(onlyProductive)
        _uiState.value = _uiState.value.copy(onlyProductive = onlyProductive)
    }

    fun addCategory(name: String, color: String, icon: String, isProductive: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val result = categoryRepository.createCategory(name, color, icon, isProductive)
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                errorMessage = result.exceptionOrNull()?.message
            )
        }
    }

    fun deleteCategory(id: String) {
        viewModelScope.launch {
            categoryRepository.deleteCategory(id)
        }
    }
}
