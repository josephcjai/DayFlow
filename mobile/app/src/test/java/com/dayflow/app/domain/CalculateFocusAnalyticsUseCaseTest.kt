package com.dayflow.app.domain

import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.CalculateFocusAnalyticsUseCase
import org.junit.Assert.assertEquals
import org.junit.Test

class CalculateFocusAnalyticsUseCaseTest {

    private val useCase = CalculateFocusAnalyticsUseCase()

    @Test
    fun testFocusAnalyticsCalculation() {
        val slots = listOf(
            Slot(
                slotKey = "2026-09-28_09:00",
                weekStart = "2026-09-28",
                plannedTask = "Work task 1",
                category = Category.WORK,
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_09:30",
                weekStart = "2026-09-28",
                plannedTask = "Work task 2",
                category = Category.WORK,
                plannedDuration = 30,
                actualDuration = 15,
                status = SlotStatus.PARTIAL
            ),
            Slot(
                slotKey = "2026-09-28_10:00",
                weekStart = "2026-09-28",
                plannedTask = "Workout",
                category = Category.HEALTH,
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_10:30",
                weekStart = "2026-09-28",
                plannedTask = "Household cleaning",
                category = Category.HOUSEHOLD,
                plannedDuration = 30,
                actualDuration = 0,
                status = SlotStatus.MISSED
            )
        )

        val analytics = useCase(slots)

        val work = analytics.first { it.category == Category.WORK }
        assertEquals(60, work.plannedMinutes)
        assertEquals(45, work.actualMinutes)
        assertEquals(75.0f, work.completionPercentage, 0.01f)

        val health = analytics.first { it.category == Category.HEALTH }
        assertEquals(30, health.plannedMinutes)
        assertEquals(30, health.actualMinutes)
        assertEquals(100.0f, health.completionPercentage, 0.01f)

        val household = analytics.first { it.category == Category.HOUSEHOLD }
        assertEquals(30, household.plannedMinutes)
        assertEquals(0, household.actualMinutes)
        assertEquals(0.0f, household.completionPercentage, 0.01f)
    }
    @Test
    fun testDailySummaryCalculationAndWorkEffectiveness() {
        val slots = listOf(
            Slot(
                slotKey = "2026-09-28_09:00",
                weekStart = "2026-09-28",
                plannedTask = "Work Task",
                category = Category.WORK, // Productive by default
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_09:30",
                weekStart = "2026-09-28",
                plannedTask = "Household Task",
                category = Category.HOUSEHOLD, // Non-productive by default
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_10:00",
                weekStart = "2026-09-28",
                plannedTask = "Personal Admin (Overridden to Productive)",
                category = Category.HOUSEHOLD,
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE,
                isProductive = true // Explicit override
            )
        )

        val summary = useCase.calculateDailySummary(slots)
        assertEquals(90, summary.plannedMinutes)
        assertEquals(90, summary.actualMinutes)
        assertEquals(60, summary.productiveMinutes) // Work (30m) + Overridden Household (30m)
        assertEquals(100, summary.completionPercentage)
        assertEquals(66, summary.effectivenessPercentage) // (60 / 90) * 100 = 66%
    }
}