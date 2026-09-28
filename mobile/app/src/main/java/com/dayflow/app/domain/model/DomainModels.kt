package com.dayflow.app.domain.model

enum class Category(val displayName: String, val hexColor: String) {
    LEARNING("Learning", "#6366F1"),
    WORK("Work", "#0284C7"),
    HOUSEHOLD("Household", "#D97706"),
    FAMILY("Family", "#DB2777"),
    HEALTH("Health", "#059669"),
    TRAVEL("Travel", "#7C3AED");

    companion object {
        fun fromString(value: String): Category {
            return entries.firstOrNull { it.displayName.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: WORK
        }
    }
}

enum class SlotStatus(val displayName: String) {
    PENDING("Pending"),
    DONE("Done"),
    PARTIAL("Partial"),
    MISSED("Missed");

    companion object {
        fun fromString(value: String): SlotStatus {
            return entries.firstOrNull { it.displayName.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: PENDING
        }
    }
}

data class Slot(
    val slotKey: String,
    val weekStart: String,
    val plannedTask: String,
    val actualTask: String = "",
    val category: Category = Category.WORK,
    val plannedDuration: Int = 30,
    val actualDuration: Int = 0,
    val status: SlotStatus = SlotStatus.PENDING,
    val notes: String? = null,
    val isSyncPending: Boolean = false
)

data class Habit(
    val id: String,
    val weekStart: String,
    val habitName: String,
    val category: Category = Category.HEALTH,
    val pointsImpact: Int = 0,
    val notes: String? = null,
    val loggedAt: String,
    val isSyncPending: Boolean = false
)

data class Todo(
    val id: String,
    val weekStart: String,
    val title: String,
    val isCompleted: Boolean = false,
    val isSyncPending: Boolean = false
)

data class FocusCategorySummary(
    val category: Category,
    val plannedMinutes: Int,
    val actualMinutes: Int,
    val completionPercentage: Float
)
