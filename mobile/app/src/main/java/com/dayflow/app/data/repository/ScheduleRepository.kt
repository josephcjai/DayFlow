package com.dayflow.app.data.repository

import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.model.DeleteSlotRequest
import com.dayflow.app.data.model.SaveSlotRequest
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.util.DateTimeUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

interface ScheduleRepository {
    fun getWeekSchedule(weekStart: String): Flow<List<ScheduleSlotEntity>>
    suspend fun refreshWeekSchedule(weekStart: String): Result<Unit>
    suspend fun saveSlot(slot: ScheduleSlotEntity): Result<Unit>
    suspend fun deleteSlot(slotKey: String): Result<Unit>
    suspend fun seedDemoSchedule(weekStart: String)
}

@Singleton
class ScheduleRepositoryImpl @Inject constructor(
    private val slotDao: ScheduleSlotDao,
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) : ScheduleRepository {

    override fun getWeekSchedule(weekStart: String): Flow<List<ScheduleSlotEntity>> {
        return slotDao.getSlotsForWeek(weekStart)
    }

    override suspend fun refreshWeekSchedule(weekStart: String): Result<Unit> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.getWeekSchedule(weekStart)
            if (response.isSuccessful && response.body() != null) {
                val weekBody = response.body()!!
                val entities = weekBody.slots.map { (key, slotDto) ->
                    ScheduleSlotEntity(
                        slotKey = key,
                        weekStart = weekStart,
                        plannedTask = slotDto.plannedTask,
                        actualTask = slotDto.actualTask,
                        category = slotDto.category,
                        plannedDuration = slotDto.plannedDuration,
                        actualDuration = slotDto.actualDuration,
                        status = slotDto.status,
                        notes = slotDto.notes,
                        isProductive = slotDto.isProductive,
                        isSyncPending = false
                    )
                }
                slotDao.clearWeek(weekStart)
                if (entities.isNotEmpty()) {
                    slotDao.upsertSlots(entities)
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch week schedule (${response.code()})"))
            }
        } catch (e: Exception) {
            // Offline: local DB remains single source of truth
            Result.failure(e)
        }
    }

    override suspend fun saveSlot(slot: ScheduleSlotEntity): Result<Unit> = withContext(Dispatchers.IO) {
        // 1. Optimistic local update (0ms UI latency)
        slotDao.upsertSlot(slot.copy(isSyncPending = true))

        if (tokenManager.isDemoMode()) {
            slotDao.upsertSlot(slot.copy(isSyncPending = false))
            return@withContext Result.success(Unit)
        }

        // 2. Dispatch network update or queue if offline
        val saveRequest = SaveSlotRequest(
            weekStart = slot.weekStart,
            slotKey = slot.slotKey,
            plannedTask = slot.plannedTask,
            actualTask = slot.actualTask,
            category = slot.category,
            plannedDuration = slot.plannedDuration,
            actualDuration = slot.actualDuration,
            status = slot.status,
            notes = slot.notes,
            isProductive = slot.isProductive
        )

        try {
            val response = apiService.saveSlot(saveRequest)
            if (response.isSuccessful) {
                slotDao.upsertSlot(slot.copy(isSyncPending = false))
                Result.success(Unit)
            } else {
                enqueueMutation("schedule/slot", "POST", json.encodeToString(saveRequest))
                Result.success(Unit)
            }
        } catch (e: Exception) {
            // Offline: enqueue for background sync
            enqueueMutation("schedule/slot", "POST", json.encodeToString(saveRequest))
            Result.success(Unit)
        }
    }

    override suspend fun deleteSlot(slotKey: String): Result<Unit> = withContext(Dispatchers.IO) {
        slotDao.deleteSlot(slotKey)

        if (tokenManager.isDemoMode()) {
            return@withContext Result.success(Unit)
        }

        val (slotDate, _) = DateTimeUtils.parseSlotKey(slotKey)
        val computedWeekStart = DateTimeUtils.getWeekKey(slotDate)
        val deleteRequest = DeleteSlotRequest(weekStart = computedWeekStart, slotKey = slotKey)
        try {
            val response = apiService.deleteSlot(deleteRequest)
            if (!response.isSuccessful && response.code() != 404) {
                enqueueMutation("schedule/slot", "DELETE", json.encodeToString(deleteRequest))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("schedule/slot", "DELETE", json.encodeToString(deleteRequest))
            Result.success(Unit)
        }
    }

    override suspend fun seedDemoSchedule(weekStart: String) = withContext(Dispatchers.IO) {
        val sampleSlots = listOf(
            ScheduleSlotEntity(
                slotKey = "${weekStart}_09:00",
                weekStart = weekStart,
                plannedTask = "Deep Work: Mobile Architecture",
                actualTask = "Deep Work: Mobile Architecture",
                category = "Work",
                plannedDuration = 30,
                actualDuration = 30,
                status = "Done",
                notes = "Completed initial design specification"
            ),
            ScheduleSlotEntity(
                slotKey = "${weekStart}_09:30",
                weekStart = weekStart,
                plannedTask = "Kotlin & Room Database Setup",
                actualTask = "Kotlin & Room Database Setup",
                category = "Learning",
                plannedDuration = 30,
                actualDuration = 30,
                status = "Done"
            ),
            ScheduleSlotEntity(
                slotKey = "${weekStart}_10:00",
                weekStart = weekStart,
                plannedTask = "Hydration & Walk Break",
                actualTask = "Hydration & Walk Break",
                category = "Health",
                plannedDuration = 30,
                actualDuration = 30,
                status = "Done"
            ),
            ScheduleSlotEntity(
                slotKey = "${weekStart}_14:00",
                weekStart = weekStart,
                plannedTask = "Family Catchup & Call",
                actualTask = "",
                category = "Family",
                plannedDuration = 30,
                actualDuration = 0,
                status = "Pending"
            )
        )
        slotDao.upsertSlots(sampleSlots)
    }

    private suspend fun enqueueMutation(endpoint: String, method: String, payloadJson: String) {
        mutationQueueDao.enqueue(
            MutationQueueEntity(
                endpoint = endpoint,
                httpMethod = method,
                payloadJson = payloadJson
            )
        )
    }
}
