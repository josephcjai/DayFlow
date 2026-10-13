package com.dayflow.app.presentation.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.usecase.LogHabitUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

@Serializable
data class QuickHabitTemplate(
    val id: String,
    val name: String,
    val category: Category,
    val points: Int,
    val defaultNotes: String? = null,
    val icon: String = "⚡",
    val isCustom: Boolean = false
)

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val habitRepository: HabitRepository,
    private val logHabitUseCase: LogHabitUseCase,
    private val tokenManager: TokenManager,
    private val json: Json
) : ViewModel() {

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

    private val _quickTemplates = MutableStateFlow(loadInitialPresets())
    val quickTemplates: StateFlow<List<QuickHabitTemplate>> = _quickTemplates.asStateFlow()

    private val _isAddRoutineDialogOpen = MutableStateFlow(false)
    val isAddRoutineDialogOpen: StateFlow<Boolean> = _isAddRoutineDialogOpen.asStateFlow()

    private val _routineToDelete = MutableStateFlow<QuickHabitTemplate?>(null)
    val routineToDelete: StateFlow<QuickHabitTemplate?> = _routineToDelete.asStateFlow()

    val loggedHabits: StateFlow<List<HabitLogEntity>> = _currentWeekStart.flatMapLatest { weekStart ->
        habitRepository.getHabits(weekStart)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val totalPoints: StateFlow<Int> = loggedHabits.map { list ->
        list.sumOf { it.pointsImpact }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0
    )

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
