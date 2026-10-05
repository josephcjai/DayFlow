package com.dayflow.app.presentation.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.HabitLogEntity
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
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class QuickHabitTemplate(
    val id: String,
    val name: String,
    val category: Category,
    val points: Int,
    val defaultNotes: String? = null
)

@HiltViewModel
class HabitsViewModel @Inject constructor(
    private val habitRepository: HabitRepository,
    private val logHabitUseCase: LogHabitUseCase
) : ViewModel() {

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

    val quickTemplates = listOf(
        QuickHabitTemplate("h1", "Morning Hydration", Category.HEALTH, 5, "500ml water"),
        QuickHabitTemplate("h2", "Deep Work Sprint", Category.WORK, 15, "90 min focus"),
        QuickHabitTemplate("h3", "Workout / Walk", Category.HEALTH, 10, "Cardio / Strength"),
        QuickHabitTemplate("h4", "Skill Reading", Category.LEARNING, 10, "30 pages"),
        QuickHabitTemplate("h5", "Household Reset", Category.HOUSEHOLD, 5, "Organize workspace"),
        QuickHabitTemplate("h6", "Family Check-in", Category.FAMILY, 10, "Connect & Call")
    )

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

    fun logQuickHabit(template: QuickHabitTemplate) {
        viewModelScope.launch {
            logHabitUseCase(
                habitName = template.name,
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
}
