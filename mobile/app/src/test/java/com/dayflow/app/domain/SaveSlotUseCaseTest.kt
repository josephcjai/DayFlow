package com.dayflow.app.domain

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class SaveSlotUseCaseTest {

    private val fakeDao = FakeSlotDao()
    private val fakeRepo = FakeScheduleRepository(fakeDao)
    private val useCase = SaveSlotUseCase(fakeRepo, fakeDao)

    @Test
    fun testSavingFutureSlotAutoFillsActualTaskIfBlank() = runBlocking {
        val slot = Slot(
            slotKey = "2026-09-28_15:00",
            weekStart = "2026-09-28",
            plannedTask = "Build Mobile UI",
            actualTask = "",
            category = Category.WORK,
            status = SlotStatus.PENDING
        )

        // Evaluate at 14:00 (future slot)
        val currentTime = LocalDateTime.of(2026, 9, 28, 14, 0)
        val result = useCase(slot, currentTime)

        assertTrue(result.isSuccess)
        val saved = fakeDao.getSlotByKey("2026-09-28_15:00")
        assertEquals("Build Mobile UI", saved?.actualTask)
    }

    @Test
    fun testGoldenTimeLockRuleRejectsModifyingPlannedTaskOnPastSlot() = runBlocking {
        val slotKey = "2026-09-28_09:00"

        // Baseline slot already exists
        fakeDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = slotKey,
                weekStart = "2026-09-28",
                plannedTask = "Original Planned Task",
                actualTask = "Original Planned Task",
                category = "Work",
                status = "Done"
            )
        )

        // User attempts to retroactively change plannedTask at 11:00 AM
        val modifiedPastSlot = Slot(
            slotKey = slotKey,
            weekStart = "2026-09-28",
            plannedTask = "Changed Planned Task (ILLEGAL)",
            actualTask = "Actual Execution",
            category = Category.WORK,
            status = SlotStatus.DONE
        )

        val currentTime = LocalDateTime.of(2026, 9, 28, 11, 0)
        val result = useCase(modifiedPastSlot, currentTime)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalStateException)
        assertEquals(
            "Baseline plan locked: plannedTask cannot be modified for past slots.",
            result.exceptionOrNull()?.message
        )
    }

    @Test
    fun testModifyingActualTaskOnPastSlotIsAllowed() = runBlocking {
        val slotKey = "2026-09-28_09:00"

        // Baseline slot already exists
        fakeDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = slotKey,
                weekStart = "2026-09-28",
                plannedTask = "Original Planned Task",
                actualTask = "Original Planned Task",
                category = "Work",
                actualDuration = 30,
                status = "Pending"
            )
        )

        // User keeps plannedTask unchanged, but updates actualTask and actualDuration at 11:00 AM
        val updatedPastSlot = Slot(
            slotKey = slotKey,
            weekStart = "2026-09-28",
            plannedTask = "Original Planned Task", // Preserved baseline
            actualTask = "Refactored Domain Architecture instead",
            actualDuration = 45,
            category = Category.LEARNING,
            status = SlotStatus.DONE
        )

        val currentTime = LocalDateTime.of(2026, 9, 28, 11, 0)
        val result = useCase(updatedPastSlot, currentTime)

        assertTrue(result.isSuccess)
        val saved = fakeDao.getSlotByKey(slotKey)
        assertEquals("Refactored Domain Architecture instead", saved?.actualTask)
        assertEquals(45, saved?.actualDuration)
        assertEquals("Done", saved?.status)
    }

    @Test
    fun testInvalidSlotKeyFailsFast() = runBlocking {
        val invalidSlot = Slot(
            slotKey = "2026-09-28_09:17", // Invalid minute
            weekStart = "2026-09-28",
            plannedTask = "Task",
            category = Category.WORK
        )

        val result = useCase(invalidSlot)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
    }
}

private class FakeSlotDao : ScheduleSlotDao {
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

private class FakeScheduleRepository(private val dao: FakeSlotDao) : ScheduleRepository {
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
