package com.dayflow.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "schedule_slots")
data class ScheduleSlotEntity(
    @PrimaryKey
    val slotKey: String, // format: "YYYY-MM-DD_HH:MM" e.g. "2026-09-28_09:30"
    val weekStart: String, // format: "YYYY-MM-DD" (Monday)
    val plannedTask: String,
    val actualTask: String = "",
    val category: String = "Work",
    val plannedDuration: Int = 30,
    val actualDuration: Int = 0,
    val status: String = "Pending", // "Pending", "Done", "Partial", "Missed"
    val notes: String? = null,
    val isProductive: Boolean? = null,
    val updatedAt: Long = System.currentTimeMillis(),
    val isSyncPending: Boolean = false
)

@Entity(tableName = "habit_logs")
data class HabitLogEntity(
    @PrimaryKey
    val id: String,
    val weekStart: String,
    val habitName: String,
    val category: String = "Health",
    val pointsImpact: Int = 0,
    val notes: String? = null,
    val loggedAt: String, // ISO timestamp
    val isSyncPending: Boolean = false
)

@Entity(tableName = "todo_items")
data class TodoEntity(
    @PrimaryKey
    val id: String,
    val weekStart: String,
    val title: String,
    val isCompleted: Boolean = false,
    val priority: String = "Medium",
    val category: String = "General",
    val scheduledSlotKey: String? = null,
    val isSyncPending: Boolean = false
)

@Entity(tableName = "weekly_notes")
data class WeeklyNotesEntity(
    @PrimaryKey
    val weekStart: String,
    val notes: String,
    val updatedAt: Long = System.currentTimeMillis(),
    val isSyncPending: Boolean = false
)

@Entity(tableName = "mutation_queue")
data class MutationQueueEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val endpoint: String,
    val httpMethod: String, // "POST", "PATCH", "DELETE"
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)

@Entity(tableName = "user_categories")
data class CategoryEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val icon: String = "📌",
    val color: String = "#64748b",
    val isProductive: Boolean = false,
    val isSystem: Boolean = false,
    val isArchived: Boolean = false,
    val sortOrder: Int = 0,
    val isSyncPending: Boolean = false
)

@Entity(tableName = "user_day_templates")
data class DayTemplateEntity(
    @PrimaryKey
    val id: String,
    val name: String,
    val description: String = "",
    val slotsJson: String = "{}",
    val isDefault: Boolean = false,
    val isSyncPending: Boolean = false
)