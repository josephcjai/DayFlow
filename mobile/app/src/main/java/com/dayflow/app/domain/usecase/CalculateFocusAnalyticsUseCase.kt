package com.dayflow.app.domain.usecase

import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.FocusCategorySummary
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import javax.inject.Inject

import com.dayflow.app.domain.model.FocusAnalyticsSummary

class CalculateFocusAnalyticsUseCase @Inject constructor() {

    fun calculateDailySummary(slots: List<Slot>): FocusAnalyticsSummary {
        val plannedMinutes = slots.sumOf { it.plannedDuration }
        val actualMinutes = slots
            .filter { it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL }
            .sumOf { it.actualDuration }
        val productiveMinutes = slots
            .filter { (it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL) && it.isProductiveSlot() }
            .sumOf { it.actualDuration }

        val completionPct = if (plannedMinutes > 0) {
            ((actualMinutes.toFloat() / plannedMinutes.toFloat()) * 100f).toInt().coerceAtMost(100)
        } else 0

        val effectivenessPct = if (actualMinutes > 0) {
            ((productiveMinutes.toFloat() / actualMinutes.toFloat()) * 100f).toInt().coerceAtMost(100)
        } else 0

        return FocusAnalyticsSummary(
            plannedMinutes = plannedMinutes,
            actualMinutes = actualMinutes,
            productiveMinutes = productiveMinutes,
            completionPercentage = completionPct,
            effectivenessPercentage = effectivenessPct
        )
    }

    operator fun invoke(slots: List<Slot>): List<FocusCategorySummary> {
        return Category.entries.map { category ->
            val matchingSlots = slots.filter { it.category == category }
            val plannedMinutes = matchingSlots.sumOf { it.plannedDuration }
            val actualMinutes = matchingSlots
                .filter { it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL }
                .sumOf { it.actualDuration }

            val percentage = if (plannedMinutes > 0) {
                ((actualMinutes.toFloat() / plannedMinutes.toFloat()) * 100f).coerceAtMost(100f)
            } else {
                0f
            }

            FocusCategorySummary(
                category = category,
                plannedMinutes = plannedMinutes,
                actualMinutes = actualMinutes,
                completionPercentage = percentage
            )
        }
    }
}
