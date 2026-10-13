package com.dayflow.app.domain

import com.dayflow.app.domain.model.AnalyticsScope
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.CalculateFocusAnalyticsUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

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
                category = Category.WORK,
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_09:30",
                weekStart = "2026-09-28",
                plannedTask = "Household Task",
                category = Category.HOUSEHOLD,
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
                isProductive = true
            )
        )

        val summary = useCase.calculateDailySummary(slots)
        assertEquals(90, summary.plannedMinutes)
        assertEquals(90, summary.actualMinutes)
        assertEquals(60, summary.productiveMinutes)
        assertEquals(100, summary.completionPercentage)
        assertEquals(66, summary.effectivenessPercentage)
    }

    @Test
    fun testCalculateScheduleAnalyticsDayScope() {
        val mon = LocalDate.of(2026, 9, 28)
        val tue = LocalDate.of(2026, 9, 29)
        val weekDays = (0..6).map { mon.plusDays(it.toLong()) }

        val monSlots = listOf(
            Slot(
                slotKey = "2026-09-28_09:00",
                weekStart = "2026-09-28",
                plannedTask = "Morning Standup",
                category = Category.WORK,
                categoryName = "Work",
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_09:30",
                weekStart = "2026-09-28",
                plannedTask = "Deep Dev",
                category = Category.WORK,
                categoryName = "Work",
                plannedDuration = 60,
                actualDuration = 60,
                status = SlotStatus.DONE
            ),
            Slot(
                slotKey = "2026-09-28_11:00",
                weekStart = "2026-09-28",
                plannedTask = "Gym",
                category = Category.HEALTH,
                categoryName = "Health",
                plannedDuration = 60,
                actualDuration = 30,
                status = SlotStatus.PARTIAL
            )
        )

        val tueSlots = listOf(
            Slot(
                slotKey = "2026-09-29_14:00",
                weekStart = "2026-09-28",
                plannedTask = "Reading",
                category = Category.LEARNING,
                categoryName = "Learning",
                plannedDuration = 60,
                actualDuration = 60,
                status = SlotStatus.DONE
            )
        )

        val allWeekSlots = monSlots + tueSlots

        val analytics = useCase.calculateScheduleAnalytics(
            daySlots = monSlots,
            weekSlots = allWeekSlots,
            categories = CategoryItem.DEFAULTS,
            selectedDate = mon,
            weekDays = weekDays,
            scope = AnalyticsScope.DAY
        )

        // Day Scope assertions: Planned = 150m (2.5h), Actual = 120m (2.0h), Productive = 90m (Work)
        assertEquals(150, analytics.plannedMinutes)
        assertEquals(120, analytics.actualMinutes)
        assertEquals(90, analytics.productiveMinutes)
        assertEquals(80, analytics.completionScore) // 120 / 150 * 100 = 80%
        assertEquals(75, analytics.effectivenessScore) // 90 / 120 * 100 = 75%
        assertEquals("2.5", analytics.plannedHours)
        assertEquals("2.0", analytics.actualHours)
        assertEquals("1.5", analytics.productiveHours)

        // Category distribution assertions (only Work & Health present on Monday)
        assertEquals(2, analytics.categoryDistribution.size)
        val workDist = analytics.categoryDistribution.first { it.categoryName == "Work" }
        assertEquals(90, workDist.plannedMinutes)
        assertEquals(90, workDist.actualMinutes)
        assertEquals(100, workDist.completionPercentage)
        assertTrue(workDist.isProductive)

        val healthDist = analytics.categoryDistribution.first { it.categoryName == "Health" }
        assertEquals(60, healthDist.plannedMinutes)
        assertEquals(30, healthDist.actualMinutes)
        assertEquals(50, healthDist.completionPercentage)
        assertFalse(healthDist.isProductive)

        // 7-Day Consistency trend assertions
        assertEquals(7, analytics.weeklyConsistencyTrend.size)
        val monTrend = analytics.weeklyConsistencyTrend[0]
        assertEquals(mon, monTrend.date)
        assertEquals("MON", monTrend.dayLabel)
        assertEquals(150, monTrend.plannedMinutes)
        assertEquals(120, monTrend.actualMinutes)
        assertTrue(monTrend.isSelected)

        val tueTrend = analytics.weeklyConsistencyTrend[1]
        assertEquals(tue, tueTrend.date)
        assertEquals(60, tueTrend.plannedMinutes)
        assertEquals(60, tueTrend.actualMinutes)
        assertFalse(tueTrend.isSelected)
    }

    @Test
    fun testCalculateScheduleAnalyticsWeekScope() {
        val mon = LocalDate.of(2026, 9, 28)
        val weekDays = (0..6).map { mon.plusDays(it.toLong()) }

        val monSlots = listOf(
            Slot(
                slotKey = "2026-09-28_09:00",
                weekStart = "2026-09-28",
                plannedTask = "Morning Standup",
                category = Category.WORK,
                categoryName = "Work",
                plannedDuration = 30,
                actualDuration = 30,
                status = SlotStatus.DONE
            )
        )

        val tueSlots = listOf(
            Slot(
                slotKey = "2026-09-29_14:00",
                weekStart = "2026-09-28",
                plannedTask = "Learning Kotlin",
                category = Category.LEARNING,
                categoryName = "Learning",
                plannedDuration = 60,
                actualDuration = 60,
                status = SlotStatus.DONE
            )
        )

        val allWeekSlots = monSlots + tueSlots

        val analytics = useCase.calculateScheduleAnalytics(
            daySlots = monSlots,
            weekSlots = allWeekSlots,
            categories = CategoryItem.DEFAULTS,
            selectedDate = mon,
            weekDays = weekDays,
            scope = AnalyticsScope.WEEK
        )

        // Week Scope assertions: aggregates all week slots (Work: 30m, Learning: 60m)
        assertEquals(90, analytics.plannedMinutes)
        assertEquals(90, analytics.actualMinutes)
        assertEquals(90, analytics.productiveMinutes) // Work (30m) + Learning (60m)
        assertEquals(100, analytics.completionScore)
        assertEquals(100, analytics.effectivenessScore)
        assertEquals(2, analytics.categoryDistribution.size)
    }
}
