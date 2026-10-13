package com.dayflow.app.domain

import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.util.DateTimeUtils
import com.dayflow.app.presentation.schedule.UndoAction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

class Phase17ScheduleParityTest {

    private lateinit var tokenManager: TokenManager
    private val testDate = LocalDate.of(2026, 10, 13)

    @Before
    fun setup() {
        tokenManager = TokenManager(null)
    }

    @Test
    fun `generateDaySlotKeys default returns exactly 48 slots`() {
        val slots = DateTimeUtils.generateDaySlotKeys(testDate)
        assertEquals(48, slots.size)
        assertEquals("2026-10-13_00:00", slots.first())
        assertEquals("2026-10-13_23:30", slots.last())
    }

    @Test
    fun `generateDaySlotKeys with workday window 8 to 18 returns 22 slots`() {
        val slots = DateTimeUtils.generateDaySlotKeys(testDate, startHour = 8, endHour = 18)
        assertEquals(22, slots.size)
        assertEquals("2026-10-13_08:00", slots.first())
        assertEquals("2026-10-13_18:30", slots.last())
    }

    @Test
    fun `generateDaySlotKeys with waking window 6 to 22 returns 34 slots`() {
        val slots = DateTimeUtils.generateDaySlotKeys(testDate, startHour = 6, endHour = 22)
        assertEquals(34, slots.size)
        assertEquals("2026-10-13_06:00", slots.first())
        assertEquals("2026-10-13_22:30", slots.last())
    }

    @Test
    fun `generateDaySlotKeys clamps invalid and out-of-range hours gracefully`() {
        // Negative start hour clamped to 0, excessive end hour clamped to 23 -> 48 slots
        val clampedFull = DateTimeUtils.generateDaySlotKeys(testDate, startHour = -5, endHour = 35)
        assertEquals(48, clampedFull.size)
        assertEquals("2026-10-13_00:00", clampedFull.first())
        assertEquals("2026-10-13_23:30", clampedFull.last())

        // Start greater than end: end is clamped to at least start
        val inverted = DateTimeUtils.generateDaySlotKeys(testDate, startHour = 15, endHour = 10)
        assertEquals(2, inverted.size) // Only 15:00 and 15:30
        assertEquals("2026-10-13_15:00", inverted.first())
        assertEquals("2026-10-13_15:30", inverted.last())
    }

    @Test
    fun `TokenManager manages timeline window reactively with StateFlow`() {
        assertEquals(0, tokenManager.getTimelineStartHour())
        assertEquals(23, tokenManager.getTimelineEndHour())
        assertEquals(0, tokenManager.timelineStartHourFlow.value)
        assertEquals(23, tokenManager.timelineEndHourFlow.value)

        tokenManager.setTimelineWindow(8, 18)
        assertEquals(8, tokenManager.getTimelineStartHour())
        assertEquals(18, tokenManager.getTimelineEndHour())
        assertEquals(8, tokenManager.timelineStartHourFlow.value)
        assertEquals(18, tokenManager.timelineEndHourFlow.value)

        // Clamp test
        tokenManager.setTimelineWindow(-10, 100)
        assertEquals(0, tokenManager.getTimelineStartHour())
        assertEquals(23, tokenManager.getTimelineEndHour())
    }

    @Test
    fun `getCurrentSlotKey accurately rounds minutes to 30-min block`() {
        val time1 = LocalDateTime.of(2026, 10, 13, 9, 14)
        assertEquals("2026-10-13_09:00", DateTimeUtils.getCurrentSlotKey(time1))

        val time2 = LocalDateTime.of(2026, 10, 13, 9, 29)
        assertEquals("2026-10-13_09:00", DateTimeUtils.getCurrentSlotKey(time2))

        val time3 = LocalDateTime.of(2026, 10, 13, 9, 30)
        assertEquals("2026-10-13_09:30", DateTimeUtils.getCurrentSlotKey(time3))

        val time4 = LocalDateTime.of(2026, 10, 13, 9, 59)
        assertEquals("2026-10-13_09:30", DateTimeUtils.getCurrentSlotKey(time4))
    }

    @Test
    fun `UndoAction stack handles single slot clear and eviction at depth 20`() {
        val undoStack = mutableListOf<UndoAction>()

        fun recordUndo(action: UndoAction) {
            undoStack.add(action)
            if (undoStack.size > 20) {
                undoStack.removeAt(0)
            }
        }

        val testSlot = Slot(
            slotKey = "2026-10-13_10:00",
            weekStart = "2026-10-12",
            plannedTask = "Deep Focus Architecture",
            actualTask = "",
            category = Category.WORK,
            status = SlotStatus.PENDING
        )

        recordUndo(UndoAction.SlotCleared(testSlot))
        assertEquals(1, undoStack.size)

        val popped = undoStack.removeAt(undoStack.lastIndex)
        assertTrue(popped is UndoAction.SlotCleared)
        val cleared = popped as UndoAction.SlotCleared
        assertEquals("Deep Focus Architecture", cleared.slot.plannedTask)

        // Test depth eviction
        for (i in 1..25) {
            val s = testSlot.copy(slotKey = "2026-10-13_${i}:00", plannedTask = "Task $i")
            recordUndo(UndoAction.SlotCleared(s))
        }

        assertEquals(20, undoStack.size)
        // First item in stack should be Task 6 (1 to 5 evicted)
        val firstInStack = undoStack.first() as UndoAction.SlotCleared
        assertEquals("Task 6", firstInStack.slot.plannedTask)
        val lastInStack = undoStack.last() as UndoAction.SlotCleared
        assertEquals("Task 25", lastInStack.slot.plannedTask)
    }

    @Test
    fun `UndoAction supports bulk clear and template overwrite payloads`() {
        val slot1 = Slot(slotKey = "2026-10-13_09:00", weekStart = "2026-10-12", plannedTask = "Task 1", category = Category.WORK, status = SlotStatus.PENDING)
        val slot2 = Slot(slotKey = "2026-10-13_09:30", weekStart = "2026-10-12", plannedTask = "Task 2", category = Category.LEARNING, status = SlotStatus.DONE)

        val bulkAction = UndoAction.BulkCleared(listOf(slot1, slot2), 2)
        assertEquals(2, bulkAction.count)
        assertEquals(2, bulkAction.slots.size)

        val templateAction = UndoAction.TemplateApplied(listOf(slot1), "Productive Workday")
        assertEquals("Productive Workday", templateAction.templateName)
        assertEquals(1, templateAction.overwrittenSlots.size)
        assertEquals("Task 1", templateAction.overwrittenSlots[0].plannedTask)
    }
}
