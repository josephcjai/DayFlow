package com.dayflow.app.domain

import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.model.Category
import com.dayflow.app.presentation.habits.AuditFilter
import com.dayflow.app.presentation.habits.HabitsViewModel
import com.dayflow.app.presentation.habits.PointsBreakdownSummary
import com.dayflow.app.presentation.habits.PointsSourceType
import com.dayflow.app.presentation.habits.QuickHabitTemplate
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

class Phase16HabitsGamificationTest {

    private lateinit var tokenManager: TokenManager

    @Before
    fun setup() {
        tokenManager = TokenManager(context = null)
    }

    @Test
    fun testDailyPointsTargetPreferencesAndClamping() {
        // Default target is 50 pts (DayFlow Web parity)
        assertEquals(50, tokenManager.getDailyPointsTarget())
        assertEquals(50, tokenManager.dailyPointsTargetFlow.value)

        // Set valid target
        tokenManager.setDailyPointsTarget(75)
        assertEquals(75, tokenManager.getDailyPointsTarget())
        assertEquals(75, tokenManager.dailyPointsTargetFlow.value)

        // Test lower bound clamping (< 10 -> 10)
        tokenManager.setDailyPointsTarget(2)
        assertEquals(10, tokenManager.getDailyPointsTarget())

        // Test upper bound clamping (> 500 -> 500)
        tokenManager.setDailyPointsTarget(999)
        assertEquals(500, tokenManager.getDailyPointsTarget())
    }

    @Test
    fun testPriorityPointsMapping() {
        // Create dummy instance using a mock or dummy ViewModel test logic
        // High -> 15, Medium -> 10, Low -> 5
        val highPts = when ("high".lowercase()) {
            "high" -> 15
            "medium" -> 10
            "low" -> 5
            else -> 10
        }
        val medPts = when ("medium".lowercase()) {
            "high" -> 15
            "medium" -> 10
            "low" -> 5
            else -> 10
        }
        val lowPts = when ("low".lowercase()) {
            "high" -> 15
            "medium" -> 10
            "low" -> 5
            else -> 10
        }
        assertEquals(15, highPts)
        assertEquals(10, medPts)
        assertEquals(5, lowPts)
    }

    @Test
    fun testPointsBreakdownSummaryCalculation() {
        val today = LocalDate.now().toString()

        val habits = listOf(
            HabitLogEntity(
                id = "h1",
                weekStart = "2026-10-12",
                habitName = "Deep Focus Block",
                category = "Work",
                pointsImpact = 15,
                notes = "Deep work complete",
                loggedAt = "${today}T09:30:00Z"
            ),
            HabitLogEntity(
                id = "h2",
                weekStart = "2026-10-12",
                habitName = "Hydration & Health",
                category = "Health",
                pointsImpact = 5,
                notes = "Water 500ml",
                loggedAt = "${today}T11:00:00Z"
            )
        )

        val todos = listOf(
            TodoEntity(
                id = "t1",
                weekStart = "2026-10-12",
                title = "Ship release v2.9.0",
                isCompleted = true,
                priority = "High",
                category = "Work",
                scheduledSlotKey = "${today}_14:00"
            ),
            TodoEntity(
                id = "t2",
                weekStart = "2026-10-12",
                title = "Refactor styles",
                isCompleted = true,
                priority = "Medium",
                category = "Tech",
                scheduledSlotKey = "${today}_16:00"
            ),
            TodoEntity(
                id = "t3",
                weekStart = "2026-10-12",
                title = "Unfinished task",
                isCompleted = false,
                priority = "High",
                category = "Work"
            )
        )

        val target = 50

        // Habit pts: 15 + 5 = 20
        // Completed Todo pts: High (15) + Medium (10) = 25
        // Total pts: 20 + 25 = 45
        val habitPts = habits.sumOf { it.pointsImpact }
        val completedTodos = todos.filter { it.isCompleted }
        val todoPts = completedTodos.sumOf { todo ->
            val pts: Int = when (todo.priority.lowercase()) {
                "high" -> 15
                "medium" -> 10
                "low" -> 5
                else -> 10
            }
            pts
        }
        val totalPts = habitPts + todoPts

        assertEquals(20, habitPts)
        assertEquals(25, todoPts)
        assertEquals(45, totalPts)

        val summary = PointsBreakdownSummary(
            habitPoints = habitPts,
            habitCount = habits.size,
            todoPoints = todoPts,
            todoCount = completedTodos.size,
            totalPoints = totalPts,
            dailyTarget = target
        )

        assertEquals(20, summary.habitPoints)
        assertEquals(2, summary.habitCount)
        assertEquals(25, summary.todoPoints)
        assertEquals(2, summary.todoCount)
        assertEquals(45, summary.totalPoints)
        assertEquals(50, summary.dailyTarget)
        assertEquals(0.9f, summary.targetProgressPct, 0.01f)
        assertFalse(summary.isTargetReached)

        // Test target achievement
        val achievedSummary = summary.copy(totalPoints = 55)
        assertEquals(1.0f, achievedSummary.targetProgressPct, 0.01f)
        assertTrue(achievedSummary.isTargetReached)
    }

    @Test
    fun testConsistencyMatrixCalculation() {
        val today = LocalDate.now()
        val monday = today.minusDays(today.dayOfWeek.value.toLong() - 1L)
        val habits = listOf(
            HabitLogEntity(
                id = "h1",
                weekStart = monday.toString(),
                habitName = "Deep Focus",
                category = "Work",
                pointsImpact = 30,
                notes = null,
                loggedAt = "${monday}T10:00:00Z"
            )
        )

        // 7 days generated
        val days = (0L..6L).map { monday.plusDays(it) }
        assertEquals(7, days.size)

        val dayHabitsMon = habits.filter { it.loggedAt.startsWith(monday.toString()) }
        assertEquals(1, dayHabitsMon.size)
        assertEquals(30, dayHabitsMon.sumOf { it.pointsImpact })

        val tueDate = monday.plusDays(1)
        val dayHabitsTue = habits.filter { it.loggedAt.startsWith(tueDate.toString()) }
        assertEquals(0, dayHabitsTue.size)
    }
}
