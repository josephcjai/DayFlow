package com.dayflow.app.domain.usecase

import com.dayflow.app.data.repository.ScheduleRepository
import javax.inject.Inject

class DeleteSlotUseCase @Inject constructor(
    private val scheduleRepository: ScheduleRepository
) {
    suspend operator fun invoke(slotKey: String): Result<Unit> {
        return scheduleRepository.deleteSlot(slotKey)
    }
}
