package com.dayflow.app.domain.usecase

import com.dayflow.app.data.local.CategoryDao
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.TodoDao
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.util.DateTimeUtils
import java.time.LocalDate
import javax.inject.Inject

sealed class ScheduleTodoResult {
    data class Success(val slotKey: String) : ScheduleTodoResult()
    data class Conflict(
        val slotKey: String,
        val existingTask: String,
        val category: String,
        val suggestedFreeSlot: String?
    ) : ScheduleTodoResult()
    data class Error(val message: String) : ScheduleTodoResult()
}

class ScheduleTodoToGridUseCase @Inject constructor(
    private val slotDao: ScheduleSlotDao,
    private val todoDao: TodoDao,
    private val categoryDao: CategoryDao,
    private val saveSlotUseCase: SaveSlotUseCase
) {
    val allTimeSlots: List<String> = (0..23).flatMap { hour ->
        listOf(
            String.format("%02d:00", hour),
            String.format("%02d:30", hour)
        )
    }

    suspend fun checkConflict(date: LocalDate, timeStr: String): Pair<Boolean, Pair<String, String>?> {
        val slotKey = "${date}_$timeStr"
        val existing = slotDao.getSlotByKey(slotKey)
        if (existing != null && (existing.plannedTask.isNotBlank() || existing.actualTask.isNotBlank())) {
            val taskName = existing.plannedTask.ifBlank { existing.actualTask }
            return Pair(true, Pair(taskName, existing.category))
        }
        return Pair(false, null)
    }

    suspend fun findNextFreeSlot(date: LocalDate, preferredTimeStr: String = "09:00"): String? {
        val startIndex = allTimeSlots.indexOf(preferredTimeStr).let { if (it >= 0) it else 0 }

        // 1. Search forward from preferred time
        for (i in startIndex until allTimeSlots.size) {
            val time = allTimeSlots[i]
            val (conflict, _) = checkConflict(date, time)
            if (!conflict) return time
        }

        // 2. Wrap around from start of day
        for (i in 0 until startIndex) {
            val time = allTimeSlots[i]
            val (conflict, _) = checkConflict(date, time)
            if (!conflict) return time
        }

        return null
    }

    suspend fun execute(
        todo: TodoEntity,
        date: LocalDate,
        timeStr: String,
        forceOverwrite: Boolean = false
    ): ScheduleTodoResult {
        val slotKey = "${date}_$timeStr"
        if (!DateTimeUtils.isValidSlotKey(slotKey)) {
            return ScheduleTodoResult.Error("Invalid slot key: $slotKey")
        }

        val (hasConflict, conflictInfo) = checkConflict(date, timeStr)
        if (hasConflict && !forceOverwrite && conflictInfo != null) {
            val suggested = findNextFreeSlot(date, timeStr)
            return ScheduleTodoResult.Conflict(
                slotKey = slotKey,
                existingTask = conflictInfo.first,
                category = conflictInfo.second,
                suggestedFreeSlot = suggested
            )
        }

        val categoryEntities = categoryDao.getActiveCategoriesSync()
        val matchedCat = categoryEntities.find { it.name.equals(todo.category, ignoreCase = true) }
        val isProductive = matchedCat?.isProductive ?: false

        val weekStart = DateTimeUtils.getWeekKey(date)
        val slot = Slot(
            slotKey = slotKey,
            plannedTask = todo.title,
            actualTask = "",
            categoryName = todo.category,
            plannedDuration = 30,
            actualDuration = 0,
            status = SlotStatus.PENDING,
            notes = "Scheduled from Weekly Todos (${todo.priority} Priority)",
            isProductive = isProductive,
            weekStart = weekStart
        )

        val saveResult = saveSlotUseCase(slot)
        return if (saveResult.isSuccess) {
            todoDao.updateScheduledSlot(todo.id, slotKey, isSyncPending = false)
            ScheduleTodoResult.Success(slotKey)
        } else {
            ScheduleTodoResult.Error(saveResult.exceptionOrNull()?.message ?: "Failed to save slot")
        }
    }

    suspend fun unschedule(todo: TodoEntity): Result<Unit> {
        val slotKey = todo.scheduledSlotKey ?: return Result.success(Unit)
        slotDao.deleteSlot(slotKey)
        todoDao.updateScheduledSlot(todo.id, null, isSyncPending = false)
        return Result.success(Unit)
    }
}
