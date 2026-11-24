package com.dayflowapp.mobile.domain.usecase

import com.dayflowapp.mobile.data.repository.ScheduleRepository
import com.dayflowapp.mobile.domain.model.Category
import com.dayflowapp.mobile.domain.model.Slot
import com.dayflowapp.mobile.domain.model.SlotStatus
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
                    categoryName = entity.category,
                    plannedDuration = entity.plannedDuration,
                    actualDuration = entity.actualDuration,
                    status = SlotStatus.fromString(entity.status),
                    notes = entity.notes,
                    isProductive = entity.isProductive,
                    isSyncPending = entity.isSyncPending
                )
            }
        }
    }
}
