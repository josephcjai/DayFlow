package com.dayflow.app.domain

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.Category
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.usecase.DeleteSlotUseCase
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDateTime

class BulkSlotActionsTest {

    private val fakeDao = BulkFakeSlotDao()
    private val fakeRepo = BulkFakeScheduleRepository(fakeDao)
    private val saveSlotUseCase = SaveSlotUseCase(fakeRepo, fakeDao)
    private val deleteSlotUseCase = DeleteSlotUseCase(fakeRepo)

    @Test
    fun testBulkMarkAsDoneSetsStatusAndDuration() = runBlocking {
        // Pre-populate 2 slots
        val slot1 = ScheduleSlotEntity(
            slotKey = "2026-10-12_09:00",
            weekStart = "2026-10-12",
            plannedTask = "Task 1",
            plannedDuration = 30,
            actualTask = "",
            actualDuration = 0,
            category = "Work",
            status = "Pending"
        )
        val slot2 = ScheduleSlotEntity(
            slotKey = "2026-10-12_09:30",
            weekStart = "2026-10-12",
            plannedTask = "Task 2",
            plannedDuration = 30,
            actualTask = "",
            actualDuration = 0,
            category = "Work",
            status = "Pending"
        )
        fakeDao.upsertSlot(slot1)
        fakeDao.upsertSlot(slot2)

        val keys = listOf("2026-10-12_09:00", "2026-10-12_09:30")
        for (key in keys) {
            val entity = fakeDao.getSlotByKey(key)!!
            val updated = Slot(
                slotKey = entity.slotKey,
                weekStart = entity.weekStart,
                plannedTask = entity.plannedTask,
                plannedDuration = entity.plannedDuration,
                actualTask = entity.actualTask,
                actualDuration = entity.plannedDuration,
                category = Category.fromString(entity.category),
                status = SlotStatus.DONE
            )
            saveSlotUseCase(updated, LocalDateTime.of(2026, 10, 12, 10, 0))
        }

        val res1 = fakeDao.getSlotByKey("2026-10-12_09:00")
        val res2 = fakeDao.getSlotByKey("2026-10-12_09:30")
        assertEquals("Done", res1?.status)
        assertEquals(30, res1?.actualDuration)
        assertEquals("Done", res2?.status)
        assertEquals(30, res2?.actualDuration)
    }

    @Test
    fun testBulkAssignCategoryUpdatesAllSelectedSlots() = runBlocking {
        val slot1 = ScheduleSlotEntity(
            slotKey = "2026-10-12_10:00",
            weekStart = "2026-10-12",
            plannedTask = "Task A",
            category = "Work",
            status = "Pending"
        )
        val slot2 = ScheduleSlotEntity(
            slotKey = "2026-10-12_10:30",
            weekStart = "2026-10-12",
            plannedTask = "Task B",
            category = "Work",
            status = "Pending"
        )
        fakeDao.upsertSlot(slot1)
        fakeDao.upsertSlot(slot2)

        val keys = listOf("2026-10-12_10:00", "2026-10-12_10:30")
        for (key in keys) {
            val entity = fakeDao.getSlotByKey(key)!!
            val updated = Slot(
                slotKey = entity.slotKey,
                weekStart = entity.weekStart,
                plannedTask = entity.plannedTask,
                actualTask = entity.actualTask,
                category = Category.HEALTH,
                categoryName = "Health",
                status = SlotStatus.PENDING
            )
            saveSlotUseCase(updated, LocalDateTime.of(2026, 10, 12, 11, 0))
        }

        val res1 = fakeDao.getSlotByKey("2026-10-12_10:00")
        val res2 = fakeDao.getSlotByKey("2026-10-12_10:30")
        assertEquals("Health", res1?.category)
        assertEquals("Health", res2?.category)
    }

    @Test
    fun testBulkClearSlotsDeletesSelectedSlots() = runBlocking {
        fakeDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-12_14:00",
                weekStart = "2026-10-12",
                plannedTask = "Clear me",
                category = "Work",
                status = "Pending"
            )
        )

        deleteSlotUseCase("2026-10-12_14:00")
        assertNull(fakeDao.getSlotByKey("2026-10-12_14:00"))
    }
}

private class BulkFakeSlotDao : ScheduleSlotDao {
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

    override suspend fun getAllSlots(): List<ScheduleSlotEntity> = slots.values.toList()
        override suspend fun clearAllSlots() { slots.clear() }
        override suspend fun clearWeek(weekStart: String) {
        slots.values.removeIf { it.weekStart == weekStart }
    }
}

private class BulkFakeScheduleRepository(private val dao: BulkFakeSlotDao) : ScheduleRepository {
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
