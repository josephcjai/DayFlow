package com.dayflow.app.domain

import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.domain.model.DefaultDayTemplates
import com.dayflow.app.domain.usecase.ApplyTemplateUseCase
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class ApplyTemplateUseCaseTest {

    private val fakeDao = TemplateFakeSlotDao()
    private val fakeRepo = TemplateFakeScheduleRepository(fakeDao)
    private val saveSlotUseCase = SaveSlotUseCase(fakeRepo, fakeDao)
    private val applyTemplateUseCase = ApplyTemplateUseCase(fakeDao, saveSlotUseCase)

    @Test
    fun testLeastPriorityRulePreservesExistingTasks() = runBlocking {
        val targetDate = LocalDate.of(2026, 10, 12)
        val existingSlotKey = "2026-10-12_09:00"

        // Pre-populate an existing custom user task in slot 09:00
        fakeDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = existingSlotKey,
                weekStart = "2026-10-12",
                plannedTask = "Existing Client Demo",
                actualTask = "",
                category = "Work",
                status = "Pending"
            )
        )

        val result = applyTemplateUseCase(
            targetDate = targetDate,
            template = DefaultDayTemplates.WORKDAY,
            currentTime = LocalDateTime.of(2026, 10, 12, 8, 0)
        )

        assertTrue(result.isSuccess)
        val data = result.getOrThrow()
        assertEquals(1, data.preservedCount)
        assertEquals(15, data.appliedCount)

        // Strict Least Priority Verification: existing task preserved
        val preservedSlot = fakeDao.getSlotByKey(existingSlotKey)
        assertEquals("Existing Client Demo", preservedSlot?.plannedTask)

        // Empty slot filled
        val filledSlot = fakeDao.getSlotByKey("2026-10-12_09:30")
        assertEquals("Deep Work: Core Priorities", filledSlot?.plannedTask)
    }

    @Test
    fun testApplyTemplateFillsAllSlotsOnFreshDay() = runBlocking {
        val targetDate = LocalDate.of(2026, 10, 18)

        val result = applyTemplateUseCase(
            targetDate = targetDate,
            template = DefaultDayTemplates.WEEKEND,
            currentTime = LocalDateTime.of(2026, 10, 18, 8, 0)
        )

        assertTrue(result.isSuccess)
        val data = result.getOrThrow()
        assertEquals(0, data.preservedCount)
        assertEquals(8, data.appliedCount)

        val workoutSlot = fakeDao.getSlotByKey("2026-10-18_09:00")
        assertEquals("Morning Workout", workoutSlot?.plannedTask)
        assertEquals("Health", workoutSlot?.category)
    }
}

private class TemplateFakeSlotDao : ScheduleSlotDao {
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

private class TemplateFakeScheduleRepository(private val dao: TemplateFakeSlotDao) : ScheduleRepository {
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
