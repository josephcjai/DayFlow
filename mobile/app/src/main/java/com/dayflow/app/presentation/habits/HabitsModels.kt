package com.dayflow.app.presentation.habits

import com.dayflow.app.domain.model.Category
import kotlinx.serialization.Serializable
import java.time.LocalDate

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

enum class PointsSourceType {
    HABIT,
    TODO
}

enum class AuditFilter {
    ALL,
    HABITS,
    TODOS
}

data class PointsAuditItem(
    val id: String,
    val date: String,
    val timeOrStatus: String,
    val sourceType: PointsSourceType,
    val sourceLabel: String,
    val title: String,
    val categoryOrDetails: String,
    val points: Int
)

data class HabitDaySummary(
    val date: LocalDate,
    val dayName: String, // "MON", "TUE", etc.
    val points: Int,
    val actionCount: Int,
    val isToday: Boolean,
    val isTargetReached: Boolean
)

data class PointsBreakdownSummary(
    val habitPoints: Int = 0,
    val habitCount: Int = 0,
    val todoPoints: Int = 0,
    val todoCount: Int = 0,
    val totalPoints: Int = 0,
    val dailyTarget: Int = 50,
    val items: List<PointsAuditItem> = emptyList()
) {
    val targetProgressPct: Float
        get() = if (dailyTarget > 0) (totalPoints.toFloat() / dailyTarget.toFloat()).coerceIn(0f, 1f) else 0f

    val isTargetReached: Boolean
        get() = totalPoints >= dailyTarget && totalPoints > 0
}
