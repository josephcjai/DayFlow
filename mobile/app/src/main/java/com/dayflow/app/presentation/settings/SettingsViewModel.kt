package com.dayflow.app.presentation.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.AuthRepository
import com.dayflow.app.data.repository.BackupInspectionResult
import com.dayflow.app.data.repository.BackupRepository
import com.dayflow.app.data.repository.BackupRestoreResult
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
    val timeFormat: String = "12h",
    val biometricsEnabled: Boolean = false,
    val dailyPointsTarget: Int = 50,
    val timelineStartHour: Int = 0,
    val timelineEndHour: Int = 23,
    val categories: List<CategoryItem> = emptyList(),
    val isLoading: Boolean = false,
    val statusMessage: String? = null,
    val errorMessage: String? = null,
    val backupInspection: BackupInspectionResult? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    private val categoryRepository: CategoryRepository,
    private val backupRepository: BackupRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            notificationsEnabled = tokenManager.isNotificationsEnabled(),
            activeWindowEnabled = tokenManager.isActiveWindowEnabled(),
            startHour = tokenManager.getNotifyStartHour(),
            endHour = tokenManager.getNotifyEndHour(),
            muteWeekends = tokenManager.isMuteWeekends(),
            onlyProductive = tokenManager.isOnlyProductive(),
            timeFormat = tokenManager.getTimeFormat(),
            biometricsEnabled = tokenManager.isBiometricsEnabled(),
            dailyPointsTarget = tokenManager.getDailyPointsTarget(),
            timelineStartHour = tokenManager.getTimelineStartHour(),
            timelineEndHour = tokenManager.getTimelineEndHour()
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

    fun setTimeFormat(format: String) {
        tokenManager.setTimeFormat(format)
        _uiState.value = _uiState.value.copy(timeFormat = format)
    }

    fun setTimelineWindow(startHour: Int, endHour: Int) {
        tokenManager.setTimelineWindow(startHour, endHour)
        _uiState.value = _uiState.value.copy(
            timelineStartHour = tokenManager.getTimelineStartHour(),
            timelineEndHour = tokenManager.getTimelineEndHour()
        )
    }

    fun setDailyPointsTarget(target: Int) {
        tokenManager.setDailyPointsTarget(target)
        _uiState.value = _uiState.value.copy(dailyPointsTarget = target)
    }

    fun setBiometricsEnabled(enabled: Boolean) {
        tokenManager.setBiometricsEnabled(enabled)
        _uiState.value = _uiState.value.copy(biometricsEnabled = enabled)
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

    suspend fun exportBackupJson(): String {
        return backupRepository.exportBackupJson()
    }

    fun inspectBackup(jsonString: String) {
        viewModelScope.launch {
            val result = backupRepository.inspectBackupJson(jsonString)
            _uiState.value = _uiState.value.copy(backupInspection = result)
        }
    }

    fun clearBackupInspection() {
        _uiState.value = _uiState.value.copy(backupInspection = null)
    }

    fun restoreBackup(
        jsonString: String,
        wipeExisting: Boolean,
        onComplete: (Boolean, String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val result = backupRepository.restoreBackupJson(jsonString, wipeExisting)
            _uiState.value = _uiState.value.copy(isLoading = false)
            if (result.isSuccess) {
                val stats = result.getOrNull()!!
                _uiState.value = _uiState.value.copy(
                    timeFormat = tokenManager.getTimeFormat(),
                    statusMessage = "Restored ${stats.slotCount} slots, ${stats.habitCount} habits, ${stats.todoCount} todos!"
                )
                categoryRepository.refreshCategories()
                onComplete(true, "Successfully restored ${stats.slotCount} slots, ${stats.habitCount} habits, and ${stats.todoCount} todos!")
            } else {
                val err = result.exceptionOrNull()?.message ?: "Failed to restore backup"
                _uiState.value = _uiState.value.copy(errorMessage = err)
                onComplete(false, err)
            }
        }
    }

    fun changePassword(
        currentPass: String,
        newPass: String,
        onComplete: (Boolean, String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val result = authRepository.changePassword(currentPass, newPass)
            _uiState.value = _uiState.value.copy(isLoading = false)
            if (result.isSuccess) {
                onComplete(true, result.getOrNull() ?: "Password updated successfully!")
            } else {
                onComplete(false, result.exceptionOrNull()?.message ?: "Failed to change password")
            }
        }
    }

    fun clearStatusMessage() {
        _uiState.value = _uiState.value.copy(statusMessage = null, errorMessage = null)
    }
}
