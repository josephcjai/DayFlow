package com.dayflow.app.domain.usecase

import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.domain.model.Category
import javax.inject.Inject

class LogHabitUseCase @Inject constructor(
    private val habitRepository: HabitRepository
) {
    suspend operator fun invoke(
        habitName: String,
        category: Category,
        pointsImpact: Int,
        notes: String?,
        weekStart: String
    ): Result<HabitLogEntity> {
        return habitRepository.logHabit(
            habitName = habitName.trim(),
            category = category.displayName,
            pointsImpact = pointsImpact,
            notes = notes,
            weekStart = weekStart
        )
    }
}
