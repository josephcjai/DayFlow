package com.dayflow.app.domain.model

enum class Category(
    val displayName: String,
    val hexColor: String,
    val icon: String = "📌",
    val defaultProductive: Boolean = false,
    val isSystem: Boolean = false
) {
    WORK("Work", "#0284C7", "💼", true, false),
    LEARNING("Learning", "#6366F1", "📚", true, false),
    HEALTH("Health", "#059669", "🏃", false, false),
    HOUSEHOLD("Household", "#D97706", "🧹", false, false),
    FAMILY("Family", "#DB2777", "👨‍👩‍👧", false, false),
    TRAVEL("Travel", "#7C3AED", "✈️", false, false),
    GENERAL("General", "#64748B", "📌", false, true);

    companion object {
        fun fromString(value: String): Category {
            return entries.firstOrNull { it.displayName.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: GENERAL
        }
    }
}

data class CategoryItem(
    val id: String = "",
    val name: String,
    val icon: String = "📌",
    val hexColor: String = "#64748b",
    val isProductive: Boolean = false,
    val isSystem: Boolean = false,
    val isArchived: Boolean = false,
    val sortOrder: Int = 0
) {
    companion object {
        val DEFAULTS = listOf(
            CategoryItem("cat_work", "Work", "💼", "#0284C7", isProductive = true, sortOrder = 0),
            CategoryItem("cat_learn", "Learning", "📚", "#6366F1", isProductive = true, sortOrder = 1),
            CategoryItem("cat_health", "Health", "🏃", "#059669", isProductive = false, sortOrder = 2),
            CategoryItem("cat_house", "Household", "🧹", "#D97706", isProductive = false, sortOrder = 3),
            CategoryItem("cat_family", "Family", "👨‍👩‍👧", "#DB2777", isProductive = false, sortOrder = 4),
            CategoryItem("cat_travel", "Travel", "✈️", "#7C3AED", isProductive = false, sortOrder = 5),
            CategoryItem("cat_general", "General", "📌", "#64748B", isProductive = false, isSystem = true, sortOrder = 6)
        )

        fun fromName(name: String): CategoryItem {
            return DEFAULTS.firstOrNull { it.name.equals(name, ignoreCase = true) }
                ?: CategoryItem(name = name, icon = "📌", hexColor = "#64748B")
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
    val categoryName: String = category.displayName,
    val plannedDuration: Int = 30,
    val actualDuration: Int = 0,
    val status: SlotStatus = SlotStatus.PENDING,
    val notes: String? = null,
    val isProductive: Boolean? = null,
    val isSyncPending: Boolean = false
) {
    fun isProductiveSlot(): Boolean = isProductive ?: (category == Category.WORK || category == Category.LEARNING)
}

data class FocusAnalyticsSummary(
    val plannedMinutes: Int,
    val actualMinutes: Int,
    val productiveMinutes: Int,
    val completionPercentage: Int,
    val effectivenessPercentage: Int
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
