package com.dayflowapp.mobile.domain.usecase

import com.dayflowapp.mobile.data.repository.ScheduleRepository
import javax.inject.Inject

class DeleteSlotUseCase @Inject constructor(
    private val scheduleRepository: ScheduleRepository
) {
    suspend operator fun invoke(slotKey: String): Result<Unit> {
        return scheduleRepository.deleteSlot(slotKey)
    }
}
