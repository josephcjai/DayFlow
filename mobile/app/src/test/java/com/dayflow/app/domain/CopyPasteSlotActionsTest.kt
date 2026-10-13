package com.dayflow.app.domain

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.time.LocalDateTime

class CopyPasteSlotActionsTest {

    private val fakeDao = CopyPasteFakeSlotDao()
    private val fakeRepo = CopyPasteFakeScheduleRepository(fakeDao)
    private val saveSlotUseCase = SaveSlotUseCase(fakeRepo, fakeDao)

    @Test
    fun testCopyAndPasteIntoFutureSlotResetsToPendingAndZeroDuration() = runBlocking {
        val sourceSlot = Slot(
            slotKey = "2026-10-12_09:00",
            weekStart = "2026-10-12",
            plannedTask = "Code Review",
            actualTask = "Code Review Done",
            category = Category.WORK,
            categoryName = "Work",
            isProductive = true,
            status = SlotStatus.DONE,
            plannedDuration = 30,
            actualDuration = 30,
            notes = "Checked PR 42"
        )

        val targetSlotKey = "2026-10-12_14:00"
        val now = LocalDateTime.of(2026, 10, 12, 10, 0)
        val isPassed = DateTimeUtils.isSlotTimePassed(targetSlotKey, now)

        assertEquals(false, isPassed)

        val taskName = sourceSlot.plannedTask.ifBlank { sourceSlot.actualTask }
        val pastedSlot = Slot(
            slotKey = targetSlotKey,
            weekStart = "2026-10-12",
            plannedTask = taskName,
            actualTask = if (!isPassed) "" else sourceSlot.actualTask,
            category = sourceSlot.category,
            categoryName = sourceSlot.categoryName,
            isProductive = sourceSlot.isProductive,
            status = if (!isPassed) SlotStatus.PENDING else sourceSlot.status,
            plannedDuration = sourceSlot.plannedDuration,
            actualDuration = if (!isPassed) 0 else sourceSlot.actualDuration,
            notes = sourceSlot.notes
        )

        saveSlotUseCase(pastedSlot, now)

        val saved = fakeDao.getSlotByKey(targetSlotKey)
        assertNotNull(saved)
        assertEquals("Code Review", saved?.plannedTask)
        assertEquals("Code Review", saved?.actualTask)
        assertEquals("Pending", saved?.status)
        assertEquals(0, saved?.actualDuration)
        assertEquals("Work", saved?.category)
        assertEquals("Checked PR 42", saved?.notes)
    }

    @Test
    fun testCopyAndPasteIntoPastSlotRetainsActualTaskAndStatus() = runBlocking {
        val sourceSlot = Slot(
            slotKey = "2026-10-12_09:00",
            weekStart = "2026-10-12",
            plannedTask = "Design System",
            actualTask = "Finished wireframes",
            category = Category.LEARNING,
            categoryName = "Learning",
            isProductive = true,
            status = SlotStatus.DONE,
            plannedDuration = 30,
            actualDuration = 30,
            notes = "Great session"
        )

        val targetSlotKey = "2026-10-12_08:00"
        val now = LocalDateTime.of(2026, 10, 12, 12, 0)
        val isPassed = DateTimeUtils.isSlotTimePassed(targetSlotKey, now)

        assertEquals(true, isPassed)

        val pastedSlot = Slot(
            slotKey = targetSlotKey,
            weekStart = "2026-10-12",
            plannedTask = sourceSlot.plannedTask,
            actualTask = sourceSlot.actualTask,
            category = sourceSlot.category,
            categoryName = sourceSlot.categoryName,
            isProductive = sourceSlot.isProductive,
            status = sourceSlot.status,
            plannedDuration = sourceSlot.plannedDuration,
            actualDuration = sourceSlot.actualDuration,
            notes = sourceSlot.notes
        )

        saveSlotUseCase(pastedSlot, now)

        val saved = fakeDao.getSlotByKey(targetSlotKey)
        assertNotNull(saved)
        assertEquals("Design System", saved?.plannedTask)
        assertEquals("Finished wireframes", saved?.actualTask)
        assertEquals("Done", saved?.status)
        assertEquals(30, saved?.actualDuration)
        assertEquals("Learning", saved?.category)
    }

    @Test
    fun testBulkPasteToMultipleSlots() = runBlocking {
        val clipboardSlot = Slot(
            slotKey = "2026-10-12_09:00",
            weekStart = "2026-10-12",
            plannedTask = "Deep Work",
            category = Category.WORK,
            categoryName = "Work",
            isProductive = true,
            status = SlotStatus.PENDING,
            plannedDuration = 30
        )

        val targetKeys = listOf("2026-10-12_15:00", "2026-10-12_15:30")
        val now = LocalDateTime.of(2026, 10, 12, 10, 0)

        for (targetKey in targetKeys) {
            val isPassed = DateTimeUtils.isSlotTimePassed(targetKey, now)
            val pasted = Slot(
                slotKey = targetKey,
                weekStart = "2026-10-12",
                plannedTask = clipboardSlot.plannedTask,
                actualTask = if (!isPassed) "" else clipboardSlot.actualTask,
                category = clipboardSlot.category,
                categoryName = clipboardSlot.categoryName,
                isProductive = clipboardSlot.isProductive,
                status = if (!isPassed) SlotStatus.PENDING else clipboardSlot.status,
                plannedDuration = clipboardSlot.plannedDuration,
                actualDuration = if (!isPassed) 0 else clipboardSlot.actualDuration
            )
            saveSlotUseCase(pasted, now)
        }

        val slot1 = fakeDao.getSlotByKey("2026-10-12_15:00")
        val slot2 = fakeDao.getSlotByKey("2026-10-12_15:30")
        assertEquals("Deep Work", slot1?.plannedTask)
        assertEquals("Deep Work", slot2?.plannedTask)
        assertEquals("Work", slot1?.category)
        assertEquals("Work", slot2?.category)
    }
}

private class CopyPasteFakeSlotDao : ScheduleSlotDao {
    private val slots = mutableMapOf<String, ScheduleSlotEntity>()

    override fun getSlotsForWeek(weekStart: String): Flow<List<ScheduleSlotEntity>> =
        flowOf(slots.values.filter { it.weekStart == weekStart })

    override suspend fun getSlotByKey(slotKey: String): ScheduleSlotEntity? = slots[slotKey]

    override suspend fun upsertSlot(slot: ScheduleSlotEntity) {
        slots[slot.slotKey] = slot
    }

    override suspend fun upsertSlots(slots: List<ScheduleSlotEntity>) {
        slots.forEach { this.slots[it.slotKey] = it }
    }

    override suspend fun deleteSlot(slotKey: String) {
        slots.remove(slotKey)
    }

    override suspend fun clearWeek(weekStart: String) {
        slots.values.removeIf { it.weekStart == weekStart }
    }
}

private class CopyPasteFakeScheduleRepository(private val dao: CopyPasteFakeSlotDao) : ScheduleRepository {
    override fun getWeekSchedule(weekStart: String): Flow<List<ScheduleSlotEntity>> =
        dao.getSlotsForWeek(weekStart)

    override suspend fun refreshWeekSchedule(weekStart: String): Result<Unit> = Result.success(Unit)

    override suspend fun saveSlot(slot: ScheduleSlotEntity): Result<Unit> {
        dao.upsertSlot(slot)
        return Result.success(Unit)
    }

    override suspend fun deleteSlot(slotKey: String): Result<Unit> {
        dao.deleteSlot(slotKey)
        return Result.success(Unit)
    }

    override suspend fun seedDemoSchedule(weekStart: String) {}
}