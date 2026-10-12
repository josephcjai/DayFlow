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

// ==========================================
// 6. Day Template Models (v2.7.0 Web Parity)
// ==========================================

data class TemplateSlot(
    val time: String,
    val title: String,
    val plannedTask: String,
    val category: String = "Work",
    val planned: Int = 30
)

data class DayTemplate(
    val id: String,
    val name: String,
    val description: String = "",
    val slots: Map<String, TemplateSlot> = emptyMap(),
    val isDefault: Boolean = false
) {
    val totalSlots: Int get() = slots.size
}

data class ApplyTemplateResult(
    val appliedCount: Int,
    val preservedCount: Int,
    val templateName: String
)

object DefaultDayTemplates {
    val WORKDAY = DayTemplate(
        id = "tmpl_workday",
        name = "Productive Workday",
        description = "Standard deep focus schedule with morning standup, deep work, and afternoon development",
        slots = mapOf(
            "09:00" to TemplateSlot("09:00", "Morning Standup & Priorities", "Morning Standup & Priorities", "Work"),
            "09:30" to TemplateSlot("09:30", "Deep Work: Core Priorities", "Deep Work: Core Priorities", "Work"),
            "10:00" to TemplateSlot("10:00", "Deep Work: Core Priorities", "Deep Work: Core Priorities", "Work"),
            "10:30" to TemplateSlot("10:30", "Deep Work: Core Priorities", "Deep Work: Core Priorities", "Work"),
            "11:00" to TemplateSlot("11:00", "Deep Work: Core Priorities", "Deep Work: Core Priorities", "Work"),
            "11:30" to TemplateSlot("11:30", "Team Sync & Code Reviews", "Team Sync & Code Reviews", "Work"),
            "12:00" to TemplateSlot("12:00", "Lunch & Recharge Walk", "Lunch & Recharge Walk", "Health"),
            "12:30" to TemplateSlot("12:30", "Lunch & Recharge Walk", "Lunch & Recharge Walk", "Health"),
            "13:00" to TemplateSlot("13:00", "Email & Admin Catch-up", "Email & Admin Catch-up", "Work"),
            "13:30" to TemplateSlot("13:30", "Task Breakdown & Planning", "Task Breakdown & Planning", "Work"),
            "14:00" to TemplateSlot("14:00", "Architecture & Feature Development", "Architecture & Feature Development", "Work"),
            "14:30" to TemplateSlot("14:30", "Architecture & Feature Development", "Architecture & Feature Development", "Work"),
            "15:00" to TemplateSlot("15:00", "Architecture & Feature Development", "Architecture & Feature Development", "Work"),
            "15:30" to TemplateSlot("15:30", "Architecture & Feature Development", "Architecture & Feature Development", "Work"),
            "16:00" to TemplateSlot("16:00", "Architecture & System Review", "Architecture & System Review", "Work"),
            "16:30" to TemplateSlot("16:30", "Daily Wrap-up & Tomorrow Prep", "Daily Wrap-up & Tomorrow Prep", "Work")
        ),
        isDefault = true
    )

    val WEEKEND = DayTemplate(
        id = "tmpl_weekend",
        name = "Weekend Reset & Leisure",
        description = "Relaxed weekend schedule balancing health, personal learning, and family time",
        slots = mapOf(
            "09:00" to TemplateSlot("09:00", "Morning Workout", "Morning Workout", "Health"),
            "09:30" to TemplateSlot("09:30", "Healthy Breakfast", "Healthy Breakfast", "Health"),
            "10:30" to TemplateSlot("10:30", "Personal Learning & Tech Reading", "Personal Learning & Tech Reading", "Learning"),
            "11:00" to TemplateSlot("11:00", "Personal Learning & Tech Reading", "Personal Learning & Tech Reading", "Learning"),
            "13:00" to TemplateSlot("13:00", "Household Organization", "Household Organization", "Household"),
            "13:30" to TemplateSlot("13:30", "Household Errands", "Household Errands", "Household"),
            "16:00" to TemplateSlot("16:00", "Family Time & Recreation", "Family Time & Recreation", "Family"),
            "16:30" to TemplateSlot("16:30", "Family Time & Recreation", "Family Time & Recreation", "Family")
        ),
        isDefault = true
    )

    val ALL = listOf(WORKDAY, WEEKEND)
}