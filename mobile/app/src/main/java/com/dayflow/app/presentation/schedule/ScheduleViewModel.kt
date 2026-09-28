package com.dayflow.app.presentation.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.repository.ScheduleRepository
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
    val isRefreshing: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ScheduleViewModel @Inject constructor(
    private val getWeekScheduleUseCase: GetWeekScheduleUseCase,
    private val saveSlotUseCase: SaveSlotUseCase,
    private val deleteSlotUseCase: DeleteSlotUseCase,
    private val scheduleRepository: ScheduleRepository
) : ViewModel() {

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
        initialValue = emptyList()
    )

    fun selectDate(date: LocalDate) {
        val monday = DateTimeUtils.getMondayOfWeek(date)
        val weekKey = DateTimeUtils.getWeekKey(date)
        val weekDays = DateTimeUtils.generateWeekDays(monday)

        _uiState.update {
            it.copy(
                selectedDate = date,
                weekStart = weekKey,
                weekDays = weekDays
            )
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
            scheduleRepository.refreshWeekSchedule(_uiState.value.weekStart)
            _uiState.update { it.copy(isRefreshing = false) }
        }
    }
}
