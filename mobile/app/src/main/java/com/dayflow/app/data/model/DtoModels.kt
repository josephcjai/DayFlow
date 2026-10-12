package com.dayflow.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ==========================================
// 1. Authentication Models
// ==========================================

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String
)

@Serializable
data class LoginRequest(
    val email: String,
    val password: String
)

@Serializable
data class UserDto(
    val id: String,
    val email: String,
    val displayName: String,
    val hasPassword: Boolean = true,
    val timezone: String? = null,
    val createdAt: String? = null
)

@Serializable
data class AuthResponse(
    val message: String? = null,
    val token: String,
    val user: UserDto
)

@Serializable
data class UserProfileResponse(
    val user: UserDto
)

@Serializable
data class ForgotPasswordRequest(
    val email: String
)

@Serializable
data class MessageResponse(
    val message: String
)

// ==========================================
// 2. Schedule Models
// ==========================================

@Serializable
data class SlotDto(
    val slotKey: String = "",
    val plannedTask: String = "",
    val actualTask: String = "",
    val category: String = "Work",
    @SerialName("planned")
    val plannedDuration: Int = 30,
    @SerialName("actual")
    val actualDuration: Int = 0,
    val status: String = "Pending",
    val notes: String? = null,
    val isProductive: Boolean? = null
)

@Serializable
data class WeekScheduleResponse(
    val weekStart: String,
    val slots: Map<String, SlotDto> = emptyMap(),
    val habits: List<HabitLogDto> = emptyList(),
    val todos: List<TodoItemDto> = emptyList(),
    val notes: String? = null
)

@Serializable
data class SaveSlotRequest(
    val weekStart: String = "",
    val slotKey: String,
    val plannedTask: String,
    val actualTask: String = "",
    val category: String = "Work",
    @SerialName("planned")
    val plannedDuration: Int = 30,
    @SerialName("actual")
    val actualDuration: Int = 0,
    val status: String = "Pending",
    val notes: String? = null,
    val isProductive: Boolean? = null,
    val clearProductive: Boolean? = null
)

@Serializable
data class SaveSlotResponse(
    val message: String? = null,
    val slot: SlotDto? = null
)

@Serializable
data class DeleteSlotRequest(
    val weekStart: String? = null,
    val slotKey: String
)

// ==========================================
// 3. Habit Models
// ==========================================

@Serializable
data class HabitLogDto(
    val id: String = "",
    @SerialName("name")
    val habitName: String = "",
    val category: String = "Health",
    @SerialName("pts")
    val pointsImpact: Int = 0,
    val notes: String? = null,
    @SerialName("time")
    val logTime: String? = null
)

@Serializable
data class LogHabitRequest(
    val weekStart: String = "",
    @SerialName("name")
    val habitName: String,
    val category: String = "Health",
    @SerialName("pts")
    val pointsImpact: Int = 0,
    val notes: String? = null,
    val logTime: String? = null
)

@Serializable
data class LogHabitResponse(
    val message: String? = null,
    val habit: HabitLogDto
)

// ==========================================
// 4. Todo & Notes Models
// ==========================================

@Serializable
data class TodoItemDto(
    val id: String = "",
    @SerialName("text")
    val title: String = "",
    @SerialName("completed")
    val isCompleted: Boolean = false,
    val priority: String = "Medium",
    val category: String = "General",
    val dueDate: String? = null,
    val weekStart: String? = null
)

@Serializable
data class CreateTodoRequest(
    val weekStart: String,
    @SerialName("text")
    val title: String
)

@Serializable
data class UpdateTodoRequest(
    @SerialName("completed")
    val isCompleted: Boolean? = null,
    @SerialName("text")
    val title: String? = null
)

@Serializable
data class SaveNotesRequest(
    val weekStart: String,
    val notes: String
)

@Serializable
data class WeekTodosResponse(
    val weekStart: String,
    val todos: List<TodoItemDto> = emptyList(),
    val notes: String? = null
)

// ==========================================
// 5. Category Models (v2.9.0 Parity)
// ==========================================

@Serializable
data class CategoryDto(
    val id: String = "",
    val name: String,
    val icon: String = "📌",
    val color: String = "#64748b",
    val isProductive: Boolean = false,
    val isSystem: Boolean = false,
    val isArchived: Boolean = false,
    val sortOrder: Int = 0
)

@Serializable
data class CategoriesResponse(
    val categories: List<CategoryDto> = emptyList()
)

// ==========================================
// 6. Day Template Models (v2.7.0 Web Parity)
// ==========================================

@Serializable
data class TemplateSlotDto(
    val title: String = "",
    val plannedTask: String = "",
    val category: String = "Work",
    val planned: Int = 30
)

@Serializable
data class DayTemplateDto(
    val id: String = "",
    val name: String,
    val description: String = "",
    val slots: Map<String, TemplateSlotDto> = emptyMap(),
    val isDefault: Boolean = false,
    val createdAt: String? = null
)

@Serializable
data class TemplatesResponse(
    val templates: List<DayTemplateDto> = emptyList()
)