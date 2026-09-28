package com.dayflow.app.domain.usecase

import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class GetWeekScheduleUseCase @Inject constructor(
    private val scheduleRepository: ScheduleRepository
) {
    operator fun invoke(weekStart: String): Flow<List<Slot>> {
        return scheduleRepository.getWeekSchedule(weekStart).map { entities ->
            entities.map { entity ->
                Slot(
                    slotKey = entity.slotKey,
                    weekStart = entity.weekStart,
                    plannedTask = entity.plannedTask,
                    actualTask = entity.actualTask,
                    category = Category.fromString(entity.category),
                    plannedDuration = entity.plannedDuration,
                    actualDuration = entity.actualDuration,
                    status = SlotStatus.fromString(entity.status),
                    notes = entity.notes,
                    isSyncPending = entity.isSyncPending
                )
            }
        }
    }
}
