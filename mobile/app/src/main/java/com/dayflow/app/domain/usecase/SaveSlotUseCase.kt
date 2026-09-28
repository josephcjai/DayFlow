package com.dayflow.app.domain.usecase

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.util.DateTimeUtils
import java.time.LocalDateTime
import javax.inject.Inject

class SaveSlotUseCase @Inject constructor(
    private val scheduleRepository: ScheduleRepository,
    private val slotDao: ScheduleSlotDao
) {
    suspend operator fun invoke(
        slot: Slot,
        currentTime: LocalDateTime = LocalDateTime.now()
    ): Result<Unit> {
        // 1. Validate slotKey structure & sanity bounds
        if (!DateTimeUtils.isValidSlotKey(slot.slotKey)) {
            return Result.failure(IllegalArgumentException("Invalid slotKey format: ${slot.slotKey}"))
        }

        val isTimePassed = DateTimeUtils.isSlotTimePassed(slot.slotKey, currentTime)

        // 2. Enforce DayFlow Golden Time-Lock Rule
        val existingEntity = slotDao.getSlotByKey(slot.slotKey)
        if (isTimePassed && existingEntity != null) {
            if (existingEntity.plannedTask != slot.plannedTask) {
                return Result.failure(
                    IllegalStateException("Baseline plan locked: plannedTask cannot be modified for past slots.")
                )
            }
        }

        // 3. For future slots, auto-fill actualTask if blank
        val resolvedActualTask = if (!isTimePassed && slot.actualTask.isBlank()) {
            slot.plannedTask
        } else {
            slot.actualTask
        }

        val entity = ScheduleSlotEntity(
            slotKey = slot.slotKey,
            weekStart = slot.weekStart,
            plannedTask = slot.plannedTask,
            actualTask = resolvedActualTask,
            category = slot.category.displayName,
            plannedDuration = slot.plannedDuration,
            actualDuration = slot.actualDuration,
            status = slot.status.displayName,
            notes = slot.notes,
            isSyncPending = true
        )

        return scheduleRepository.saveSlot(entity)
    }
}
