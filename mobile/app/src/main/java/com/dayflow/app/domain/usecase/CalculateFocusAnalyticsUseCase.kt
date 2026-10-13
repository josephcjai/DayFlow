package com.dayflow.app.domain.usecase

import com.dayflow.app.domain.model.AnalyticsScope
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.CategoryDistributionItem
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.DayConsistencyItem
import com.dayflow.app.domain.model.FocusAnalyticsSummary
import com.dayflow.app.domain.model.FocusCategorySummary
import com.dayflow.app.domain.model.ScheduleAnalyticsData
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

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

    fun calculateScheduleAnalytics(
        daySlots: List<Slot>,
        weekSlots: List<Slot>,
        categories: List<CategoryItem>,
        selectedDate: LocalDate,
        weekDays: List<LocalDate>,
        scope: AnalyticsScope
    ): ScheduleAnalyticsData {
        val targetSlots = if (scope == AnalyticsScope.DAY) daySlots else weekSlots

        val plannedMinutes = targetSlots.sumOf { it.plannedDuration }
        val actualMinutes = targetSlots
            .filter { it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL }
            .sumOf { it.actualDuration }
        val productiveMinutes = targetSlots
            .filter { (it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL) && it.isProductiveSlot() }
            .sumOf { it.actualDuration }

        val completionScore = if (plannedMinutes > 0) {
            ((actualMinutes.toFloat() / plannedMinutes.toFloat()) * 100f).toInt().coerceAtMost(100)
        } else 0

        val effectivenessScore = if (actualMinutes > 0) {
            ((productiveMinutes.toFloat() / actualMinutes.toFloat()) * 100f).toInt().coerceAtMost(100)
        } else 0

        // Group by category name (case-insensitive key mapping)
        val catMap = categories.associateBy { it.name.lowercase() }
        val groupedByCat = targetSlots.groupBy { it.categoryName.ifBlank { it.category.displayName } }

        val distribution = groupedByCat.mapNotNull { (rawCatName, slots) ->
            val pMins = slots.sumOf { it.plannedDuration }
            val aMins = slots
                .filter { it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL }
                .sumOf { it.actualDuration }

            if (pMins == 0 && aMins == 0) return@mapNotNull null

            val catItem = catMap[rawCatName.lowercase()] ?: CategoryItem.fromName(rawCatName)
            val isProductive = slots.any { it.isProductiveSlot() } || catItem.isProductive
            val pct = if (pMins > 0) {
                ((aMins.toFloat() / pMins.toFloat()) * 100f).toInt().coerceAtMost(100)
            } else if (aMins > 0) 100 else 0

            CategoryDistributionItem(
                categoryName = catItem.name,
                icon = catItem.icon,
                hexColor = catItem.hexColor,
                isProductive = isProductive,
                plannedMinutes = pMins,
                actualMinutes = aMins,
                completionPercentage = pct
            )
        }.sortedWith(
            compareByDescending<CategoryDistributionItem> { it.actualMinutes }
                .thenByDescending { it.plannedMinutes }
        )

        val today = LocalDate.now()
        val dateFormatter = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())

        val consistencyTrend = weekDays.map { date ->
            val datePrefix = date.toString()
            val slotsForDay = weekSlots.filter { it.slotKey.startsWith(datePrefix) }
            val dayPlanned = slotsForDay.sumOf { it.plannedDuration }
            val dayActual = slotsForDay
                .filter { it.status == SlotStatus.DONE || it.status == SlotStatus.PARTIAL }
                .sumOf { it.actualDuration }

            DayConsistencyItem(
                date = date,
                dayLabel = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()).uppercase(),
                dateLabel = date.format(dateFormatter),
                plannedMinutes = dayPlanned,
                actualMinutes = dayActual,
                isSelected = (date == selectedDate),
                isToday = (date == today)
            )
        }

        return ScheduleAnalyticsData(
            scope = scope,
            plannedMinutes = plannedMinutes,
            actualMinutes = actualMinutes,
            productiveMinutes = productiveMinutes,
            completionScore = completionScore,
            effectivenessScore = effectivenessScore,
            categoryDistribution = distribution,
            weeklyConsistencyTrend = consistencyTrend
        )
    }
}
