package com.dayflow.app.presentation.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.usecase.LogHabitUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val habitRepository: HabitRepository,
    private val todoRepository: TodoRepository,
    private val logHabitUseCase: LogHabitUseCase,
    private val tokenManager: TokenManager,
    private val json: Json
) : ViewModel() {

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

    val dailyPointsTarget: StateFlow<Int> = tokenManager.dailyPointsTargetFlow

    private val _quickTemplates = MutableStateFlow(loadInitialPresets())
    val quickTemplates: StateFlow<List<QuickHabitTemplate>> = _quickTemplates.asStateFlow()

    private val _isAddRoutineDialogOpen = MutableStateFlow(false)
    val isAddRoutineDialogOpen: StateFlow<Boolean> = _isAddRoutineDialogOpen.asStateFlow()

    private val _routineToDelete = MutableStateFlow<QuickHabitTemplate?>(null)
    val routineToDelete: StateFlow<QuickHabitTemplate?> = _routineToDelete.asStateFlow()

    private val _isBreakdownSheetOpen = MutableStateFlow(false)
    val isBreakdownSheetOpen: StateFlow<Boolean> = _isBreakdownSheetOpen.asStateFlow()

    private val _isEditTargetDialogOpen = MutableStateFlow(false)
    val isEditTargetDialogOpen: StateFlow<Boolean> = _isEditTargetDialogOpen.asStateFlow()

    private val _selectedAuditFilter = MutableStateFlow(AuditFilter.ALL)
    val selectedAuditFilter: StateFlow<AuditFilter> = _selectedAuditFilter.asStateFlow()

    val loggedHabits: StateFlow<List<HabitLogEntity>> = _currentWeekStart.flatMapLatest { weekStart ->
        habitRepository.getHabits(weekStart)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val weekTodos: StateFlow<List<TodoEntity>> = _currentWeekStart.flatMapLatest { weekStart ->
        todoRepository.getTodos(weekStart)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val pointsBreakdown: StateFlow<PointsBreakdownSummary> = combine(
        loggedHabits,
        weekTodos,
        dailyPointsTarget
    ) { habits, todos, target ->
        calculateBreakdown(habits, todos, target)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = PointsBreakdownSummary()
    )

    val totalPoints: StateFlow<Int> = pointsBreakdown.map { it.totalPoints }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0
    )

    val consistencyMatrix: StateFlow<List<HabitDaySummary>> = combine(
        _currentWeekStart,
        loggedHabits,
        dailyPointsTarget
    ) { weekStartStr, habits, target ->
        calculateConsistencyMatrix(weekStartStr, habits, target)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    fun openAddRoutineDialog() {
        _isAddRoutineDialogOpen.value = true
    }

    fun closeAddRoutineDialog() {
        _isAddRoutineDialogOpen.value = false
    }

    fun promptDeleteRoutine(template: QuickHabitTemplate) {
        if (template.isCustom) {
            _routineToDelete.value = template
        }
    }

    fun cancelDeleteRoutine() {
        _routineToDelete.value = null
    }

    fun confirmDeleteRoutine() {
        val target = _routineToDelete.value ?: return
        _quickTemplates.update { list ->
            val updated = list.filterNot { it.id == target.id }
            persistCustomPresets(updated)
            updated
        }
        _routineToDelete.value = null
    }

    fun openBreakdownSheet() {
        _isBreakdownSheetOpen.value = true
    }

    fun closeBreakdownSheet() {
        _isBreakdownSheetOpen.value = false
    }

    fun openEditTargetDialog() {
        _isEditTargetDialogOpen.value = true
    }

    fun closeEditTargetDialog() {
        _isEditTargetDialogOpen.value = false
    }

    fun setDailyPointsTarget(target: Int) {
        tokenManager.setDailyPointsTarget(target)
        _isEditTargetDialogOpen.value = false
    }

    fun setAuditFilter(filter: AuditFilter) {
        _selectedAuditFilter.value = filter
    }

    fun addCustomRoutine(
        name: String,
        category: Category,
        points: Int,
        icon: String = "⚡",
        notes: String? = null
    ) {
        if (name.isBlank()) return
        val newRoutine = QuickHabitTemplate(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            category = category,
            points = points.coerceIn(1, 100),
            defaultNotes = notes?.trim()?.ifEmpty { null },
            icon = icon.ifBlank { "⚡" },
            isCustom = true
        )
        _quickTemplates.update { list ->
            val updated = list + newRoutine
            persistCustomPresets(updated)
            updated
        }
        _isAddRoutineDialogOpen.value = false
    }

    fun logQuickHabit(template: QuickHabitTemplate) {
        viewModelScope.launch {
            logHabitUseCase(
                habitName = "${template.icon} ${template.name}".trim(),
                category = template.category,
                pointsImpact = template.points,
                notes = template.defaultNotes,
                weekStart = _currentWeekStart.value
            )
        }
    }

    fun logCustomHabit(name: String, category: Category, points: Int, notes: String?) {
        if (name.isBlank()) return
        viewModelScope.launch {
            logHabitUseCase(
                habitName = name.trim(),
                category = category,
                pointsImpact = points,
                notes = notes?.trim()?.ifEmpty { null },
                weekStart = _currentWeekStart.value
            )
        }
    }

    fun deleteHabit(id: String) {
        viewModelScope.launch {
            habitRepository.deleteHabit(id)
        }
    }

    private fun loadInitialPresets(): List<QuickHabitTemplate> {
        val customPresets = try {
            val jsonStr = tokenManager.getCustomHabitPresetsJson()
            if (!jsonStr.isNullOrBlank()) {
                json.decodeFromString<List<QuickHabitTemplate>>(jsonStr)
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            emptyList()
        }
        return DEFAULT_PRESETS + customPresets
    }

    private fun persistCustomPresets(templates: List<QuickHabitTemplate>) {
        val customOnly = templates.filter { it.isCustom }
        try {
            val jsonStr = json.encodeToString(customOnly)
            tokenManager.saveCustomHabitPresetsJson(jsonStr)
        } catch (e: Exception) {
            // Log/ignore fallback
        }
    }

    fun getTodoPriorityPoints(priority: String): Int {
        return when (priority.lowercase()) {
            "high" -> 15
            "medium" -> 10
            "low" -> 5
            else -> 10
        }
    }

    fun calculateBreakdown(
        habits: List<HabitLogEntity>,
        todos: List<TodoEntity>,
        target: Int
    ): PointsBreakdownSummary {
        val habitItems = habits.map { h ->
            PointsAuditItem(
                id = h.id,
                date = h.loggedAt.take(10).ifEmpty { _currentWeekStart.value },
                timeOrStatus = formatLoggedTime(h.loggedAt),
                sourceType = PointsSourceType.HABIT,
                sourceLabel = "🍽️ Habit Trigger",
                title = h.habitName,
                categoryOrDetails = h.notes ?: h.category,
                points = h.pointsImpact
            )
        }

        val completedTodos = todos.filter { it.isCompleted }
        val todoItems = completedTodos.map { t ->
            val pts = getTodoPriorityPoints(t.priority)
            PointsAuditItem(
                id = t.id,
                date = t.scheduledSlotKey?.take(10) ?: _currentWeekStart.value,
                timeOrStatus = "Completed",
                sourceType = PointsSourceType.TODO,
                sourceLabel = "🎯 Priority Goal",
                title = t.title,
                categoryOrDetails = "${t.priority} Priority (${t.category})",
                points = pts
            )
        }

        val allItems = (habitItems + todoItems).sortedByDescending { it.date }
        val habitPts = habits.sumOf { it.pointsImpact }
        val todoPts = todoItems.sumOf { it.points }

        return PointsBreakdownSummary(
            habitPoints = habitPts,
            habitCount = habits.size,
            todoPoints = todoPts,
            todoCount = completedTodos.size,
            totalPoints = habitPts + todoPts,
            dailyTarget = target,
            items = allItems
        )
    }

    fun calculateConsistencyMatrix(
        weekStartStr: String,
        habits: List<HabitLogEntity>,
        target: Int
    ): List<HabitDaySummary> {
        val monday = try {
            LocalDate.parse(weekStartStr)
        } catch (e: Exception) {
            DateTimeUtils.getMondayOfWeek(LocalDate.now())
        }
        val days = DateTimeUtils.generateWeekDays(monday)
        val today = LocalDate.now()
        val dayNames = listOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")

        return days.mapIndexed { idx, date ->
            val dateIso = date.toString()
            val dayHabits = habits.filter { h ->
                h.loggedAt.startsWith(dateIso)
            }
            val pts = dayHabits.sumOf { it.pointsImpact }
            HabitDaySummary(
                date = date,
                dayName = dayNames.getOrElse(idx) { date.dayOfWeek.name.take(3) },
                points = pts,
                actionCount = dayHabits.size,
                isToday = date == today,
                isTargetReached = pts >= target && pts > 0
            )
        }
    }

    private fun formatLoggedTime(iso: String): String {
        return try {
            val instant = java.time.Instant.parse(iso)
            val localTime = java.time.LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault()).toLocalTime()
            val is24h = tokenManager.getTimeFormat() == "24h"
            DateTimeUtils.formatTimeLabel(localTime, is24Hour = is24h)
        } catch (e: Exception) {
            if (iso.contains("T") && iso.length >= 16) {
                iso.substring(11, 16)
            } else {
                iso.take(10).ifEmpty { "—" }
            }
        }
    }

    companion object {
        val DEFAULT_PRESETS = listOf(
            QuickHabitTemplate("p1", "Deep Focus Block", Category.WORK, 15, "Deep Work / Study Complete", icon = "🎯"),
            QuickHabitTemplate("p2", "Hydration & Health", Category.HEALTH, 5, "Drank Water (500ml+)", icon = "💧"),
            QuickHabitTemplate("p3", "Exercise & Workout", Category.HEALTH, 15, "30-Min Workout / Walk", icon = "🏃"),
            QuickHabitTemplate("p4", "Daily Learning & Reading", Category.LEARNING, 10, "Read / Skill Practice", icon = "📚"),
            QuickHabitTemplate("p5", "Healthy Meal", Category.HEALTH, 5, "Nutritious Meal Logged", icon = "🍽️"),
            QuickHabitTemplate("p6", "Mindful Break & Stretch", Category.HEALTH, 5, "Stretching / Rest Period", icon = "🧘")
        )
    }
}
