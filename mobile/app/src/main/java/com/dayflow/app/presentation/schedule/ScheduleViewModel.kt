package com.dayflow.app.presentation.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.repository.TemplateRepository
import com.dayflow.app.domain.model.DayTemplate
import com.dayflow.app.domain.usecase.ApplyTemplateUseCase
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.data.sync.SyncManager
import com.dayflow.app.data.sync.SyncStatus
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.DeleteSlotUseCase
import com.dayflow.app.domain.usecase.GetWeekScheduleUseCase
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject
import android.content.Context
import androidx.glance.appwidget.updateAll
import com.dayflow.app.presentation.widget.DayFlowWidget
import dagger.hilt.android.qualifiers.ApplicationContext

data class SlotRowUiModel(
    val slotKey: String,
    val timeLabel: String,       // e.g. "09:00"
    val endTimeLabel: String,    // e.g. "09:30"
    val slot: Slot?,
    val isTimePassed: Boolean,
    val isCurrentSlot: Boolean
)

data class ScheduleUiState(
    val selectedDate: LocalDate = LocalDate.now(),
    val weekStart: String = DateTimeUtils.getWeekKey(LocalDate.now()),
    val weekDays: List<LocalDate> = DateTimeUtils.generateWeekDays(DateTimeUtils.getMondayOfWeek(LocalDate.now())),
    val editingSlot: Slot? = null,
    val isEditingNewSlot: Boolean = false,
    val editingSlotKey: String? = null,
    val errorMessage: String? = null,
    val isRefreshing: Boolean = false,
    val syncStatus: SyncStatus = SyncStatus.IDLE,
    val isTemplateSheetOpen: Boolean = false,
    val templateFeedbackMessage: String? = null,
    val isSelectionMode: Boolean = false,
    val selectedSlotKeys: Set<String> = emptySet(),
    val isCategoryPickerOpen: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ScheduleViewModel @Inject constructor(
    private val getWeekScheduleUseCase: GetWeekScheduleUseCase,
    private val saveSlotUseCase: SaveSlotUseCase,
    private val deleteSlotUseCase: DeleteSlotUseCase,
    private val scheduleRepository: ScheduleRepository,
    private val syncManager: SyncManager,
    private val categoryRepository: CategoryRepository,
    private val templateRepository: TemplateRepository,
    private val applyTemplateUseCase: ApplyTemplateUseCase,
    @ApplicationContext private val context: Context
) : ViewModel() {

    val categories: StateFlow<List<CategoryItem>> = categoryRepository.getCategories()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = CategoryItem.DEFAULTS
        )

    val templates: StateFlow<List<DayTemplate>> = templateRepository.getTemplates()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    // Observe week schedule from Room DB reactively
    private val weekSlotsFlow = _uiState.flatMapLatest { state ->
        getWeekScheduleUseCase(state.weekStart)
    }

    // 48-slot timeline for the currently selected date
    val daySlots: StateFlow<List<SlotRowUiModel>> = combine(
        _uiState,
        weekSlotsFlow
    ) { state, weekSlots ->
        val slotsMap = weekSlots.associateBy { it.slotKey }
        val allDayKeys = DateTimeUtils.generateDaySlotKeys(state.selectedDate)
        val now = LocalDateTime.now()
        val isToday = state.selectedDate == LocalDate.now()

        allDayKeys.map { key ->
            val (_, time) = DateTimeUtils.parseSlotKey(key)
            val endTime = time.plusMinutes(30)
            val isPassed = DateTimeUtils.isSlotTimePassed(key, now)
            val isCurrent = isToday && !now.toLocalTime().isBefore(time) && now.toLocalTime().isBefore(endTime)

            SlotRowUiModel(
                slotKey = key,
                timeLabel = String.format("%02d:%02d", time.hour, time.minute),
                endTimeLabel = String.format("%02d:%02d", endTime.hour, endTime.minute),
                slot = slotsMap[key],
                isTimePassed = isPassed,
                isCurrentSlot = isCurrent
            )
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = buildInitialDaySlots(LocalDate.now())
    )

    init {
        viewModelScope.launch {
            templateRepository.seedDefaultTemplates()
        }
        viewModelScope.launch {
            syncManager.syncStatus.collect { status ->
                _uiState.update { it.copy(syncStatus = status) }
            }
        }
        refreshSchedule()
    }

    fun selectDate(date: LocalDate) {
        val monday = DateTimeUtils.getMondayOfWeek(date)
        val weekKey = DateTimeUtils.getWeekKey(date)
        val weekDays = DateTimeUtils.generateWeekDays(monday)
        val oldWeek = _uiState.value.weekStart

        _uiState.update {
            it.copy(
                selectedDate = date,
                weekStart = weekKey,
                weekDays = weekDays
            )
        }

        if (weekKey != oldWeek) {
            viewModelScope.launch {
                scheduleRepository.refreshWeekSchedule(weekKey)
            }
        }
    }

    fun nextWeek() {
        selectDate(_uiState.value.selectedDate.plusWeeks(1))
    }

    fun previousWeek() {
        selectDate(_uiState.value.selectedDate.minusWeeks(1))
    }

    fun selectToday() {
        selectDate(LocalDate.now())
    }

    fun openSlotEditor(slotKey: String, existingSlot: Slot?) {
        val (slotDate, _) = DateTimeUtils.parseSlotKey(slotKey)
        val computedWeekStart = DateTimeUtils.getWeekKey(slotDate)

        val slotToEdit = existingSlot ?: Slot(
            slotKey = slotKey,
            weekStart = computedWeekStart,
            plannedTask = "",
            actualTask = "",
            category = Category.WORK,
            status = SlotStatus.PENDING
        )

        _uiState.update {
            it.copy(
                editingSlot = slotToEdit,
                editingSlotKey = slotKey,
                isEditingNewSlot = (existingSlot == null),
                errorMessage = null
            )
        }
    }

    fun closeSlotEditor() {
        _uiState.update {
            it.copy(
                editingSlot = null,
                editingSlotKey = null,
                errorMessage = null
            )
        }
        viewModelScope.launch {
            try {
                DayFlowWidget().updateAll(context)
            } catch (e: Exception) {
                // Ignore if no widget placed
            }
        }
    }

    fun saveSlot(slot: Slot) {
        viewModelScope.launch {
            val result = saveSlotUseCase(slot)
            result.fold(
                onSuccess = {
                    closeSlotEditor()
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(errorMessage = error.localizedMessage ?: "Failed to save slot")
                    }
                }
            )
        }
    }

    fun quickToggleStatus(slot: Slot) {
        val nextStatus = when (slot.status) {
            SlotStatus.PENDING -> SlotStatus.DONE
            SlotStatus.DONE -> SlotStatus.PARTIAL
            SlotStatus.PARTIAL -> SlotStatus.MISSED
            SlotStatus.MISSED -> SlotStatus.PENDING
        }

        val updatedActualDuration = if (nextStatus == SlotStatus.DONE && slot.actualDuration == 0) {
            slot.plannedDuration
        } else {
            slot.actualDuration
        }

        saveSlot(slot.copy(status = nextStatus, actualDuration = updatedActualDuration))
    }

    fun deleteSlot(slotKey: String) {
        viewModelScope.launch {
            deleteSlotUseCase(slotKey)
            closeSlotEditor()
        }
    }

    fun refreshSchedule() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true) }
            syncManager.syncNow()
            templateRepository.refreshTemplates()
            scheduleRepository.refreshWeekSchedule(_uiState.value.weekStart)
            _uiState.update { it.copy(isRefreshing = false) }
        }
    }

    fun openTemplateSheet() {
        _uiState.update { it.copy(isTemplateSheetOpen = true, templateFeedbackMessage = null) }
    }

    fun closeTemplateSheet() {
        _uiState.update { it.copy(isTemplateSheetOpen = false) }
    }

    fun applyTemplate(template: DayTemplate) {
        viewModelScope.launch {
            val result = applyTemplateUseCase(_uiState.value.selectedDate, template)
            result.fold(
                onSuccess = { res ->
                    val msg = "Applied ${res.appliedCount} slots" +
                            if (res.preservedCount > 0) " (${res.preservedCount} preserved)" else ""
                    _uiState.update {
                        it.copy(
                            isTemplateSheetOpen = false,
                            templateFeedbackMessage = msg
                        )
                    }
                    scheduleRepository.refreshWeekSchedule(_uiState.value.weekStart)
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(errorMessage = error.localizedMessage ?: "Failed to apply template")
                    }
                }
            )
        }
    }

    fun clearTemplateFeedback() {
        _uiState.update { it.copy(templateFeedbackMessage = null) }
    }

    fun enterSelectionMode(slotKey: String) {
        _uiState.update {
            it.copy(
                isSelectionMode = true,
                selectedSlotKeys = setOf(slotKey)
            )
        }
    }

    fun toggleSlotSelection(slotKey: String) {
        _uiState.update { state ->
            val newSelection = if (state.selectedSlotKeys.contains(slotKey)) {
                state.selectedSlotKeys - slotKey
            } else {
                state.selectedSlotKeys + slotKey
            }
            state.copy(
                selectedSlotKeys = newSelection,
                isSelectionMode = newSelection.isNotEmpty()
            )
        }
    }

    fun selectAllCurrentDaySlots() {
        val dayKeys = DateTimeUtils.generateDaySlotKeys(_uiState.value.selectedDate).toSet()
        _uiState.update {
            it.copy(
                isSelectionMode = true,
                selectedSlotKeys = dayKeys
            )
        }
    }

    fun clearSelection() {
        _uiState.update {
            it.copy(
                isSelectionMode = false,
                selectedSlotKeys = emptySet(),
                isCategoryPickerOpen = false
            )
        }
    }

    fun openBulkCategoryPicker() {
        _uiState.update { it.copy(isCategoryPickerOpen = true) }
    }

    fun closeBulkCategoryPicker() {
        _uiState.update { it.copy(isCategoryPickerOpen = false) }
    }

    fun bulkMarkAsDone() {
        viewModelScope.launch {
            val keys = _uiState.value.selectedSlotKeys.toList()
            var updatedCount = 0
            val currentSlots = daySlots.value.associate { it.slotKey to it.slot }

            for (key in keys) {
                val slot = currentSlots[key]
                if (slot != null && (slot.plannedTask.isNotBlank() || slot.actualTask.isNotBlank())) {
                    val updated = slot.copy(
                        status = SlotStatus.DONE,
                        actualDuration = if (slot.actualDuration == 0) slot.plannedDuration else slot.actualDuration
                    )
                    saveSlotUseCase(updated)
                    updatedCount++
                }
            }

            clearSelection()
            _uiState.update {
                it.copy(templateFeedbackMessage = "Marked $updatedCount slots as Done")
            }
        }
    }

    fun bulkAssignCategory(categoryItem: CategoryItem) {
        viewModelScope.launch {
            val keys = _uiState.value.selectedSlotKeys.toList()
            var updatedCount = 0
            val currentSlots = daySlots.value.associate { it.slotKey to it.slot }
            val parsedCat = Category.fromString(categoryItem.name)

            for (key in keys) {
                val slot = currentSlots[key]
                if (slot != null && (slot.plannedTask.isNotBlank() || slot.actualTask.isNotBlank())) {
                    val updated = slot.copy(
                        category = parsedCat,
                        categoryName = categoryItem.name
                    )
                    saveSlotUseCase(updated)
                    updatedCount++
                }
            }

            clearSelection()
            _uiState.update {
                it.copy(templateFeedbackMessage = "Updated category to '${categoryItem.name}' for $updatedCount slots")
            }
        }
    }

    fun bulkClearSlots() {
        viewModelScope.launch {
            val keys = _uiState.value.selectedSlotKeys.toList()
            var clearedCount = 0

            for (key in keys) {
                deleteSlotUseCase(key)
                clearedCount++
            }

            clearSelection()
            _uiState.update {
                it.copy(templateFeedbackMessage = "Cleared $clearedCount slots")
            }
        }
    }
    companion object {
        fun buildInitialDaySlots(selectedDate: LocalDate): List<SlotRowUiModel> {
            val allDayKeys = DateTimeUtils.generateDaySlotKeys(selectedDate)
            val now = LocalDateTime.now()
            val isToday = selectedDate == LocalDate.now()
            return allDayKeys.map { key ->
                val (_, time) = DateTimeUtils.parseSlotKey(key)
                val endTime = time.plusMinutes(30)
                val isPassed = DateTimeUtils.isSlotTimePassed(key, now)
                val isCurrent = isToday && !now.toLocalTime().isBefore(time) && now.toLocalTime().isBefore(endTime)
                SlotRowUiModel(
                    slotKey = key,
                    timeLabel = String.format("%02d:%02d", time.hour, time.minute),
                    endTimeLabel = String.format("%02d:%02d", endTime.hour, endTime.minute),
                    slot = null,
                    isTimePassed = isPassed,
                    isCurrentSlot = isCurrent
                )
            }
        }
    }
}