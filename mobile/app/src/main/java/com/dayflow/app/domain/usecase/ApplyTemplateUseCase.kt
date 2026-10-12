package com.dayflow.app.domain.usecase

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.domain.model.ApplyTemplateResult
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.DayTemplate
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.util.DateTimeUtils
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

/**
 * Applies a Day Template to a target date using the Least Priority Rule:
 * Populates only empty/unplanned 30-min slots. Existing planned tasks and actual tasks
 * are strictly preserved and never overwritten.
 */
class ApplyTemplateUseCase @Inject constructor(
    private val slotDao: ScheduleSlotDao,
    private val saveSlotUseCase: SaveSlotUseCase
) {
    suspend operator fun invoke(
        targetDate: LocalDate,
        template: DayTemplate,
        currentTime: LocalDateTime = LocalDateTime.now()
    ): Result<ApplyTemplateResult> {
        val weekStart = DateTimeUtils.getWeekKey(targetDate)
        var appliedCount = 0
        var preservedCount = 0

        for ((timeStr, templateSlot) in template.slots) {
            val slotKey = String.format("%s_%s", targetDate.toString(), timeStr)
            val existing = slotDao.getSlotByKey(slotKey)

            if (existing != null && (existing.plannedTask.isNotBlank() || existing.actualTask.isNotBlank())) {
                // Least Priority Rule: preserve existing user data
                preservedCount++
            } else {
                val cat = Category.fromString(templateSlot.category)
                val newSlot = Slot(
                    slotKey = slotKey,
                    weekStart = weekStart,
                    plannedTask = templateSlot.plannedTask,
                    actualTask = "",
                    category = cat,
                    categoryName = templateSlot.category,
                    plannedDuration = templateSlot.planned,
                    actualDuration = 0,
                    status = SlotStatus.PENDING,
                    notes = null,
                    isProductive = null
                )
                val saveResult = saveSlotUseCase(newSlot, currentTime)
                if (saveResult.isSuccess) {
                    appliedCount++
                }
            }
        }

        return Result.success(
            ApplyTemplateResult(
                appliedCount = appliedCount,
                preservedCount = preservedCount,
                templateName = template.name
            )
        )
    }
}