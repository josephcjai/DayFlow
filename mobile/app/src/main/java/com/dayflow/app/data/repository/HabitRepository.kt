package com.dayflow.app.data.repository

import com.dayflow.app.data.local.HabitLogDao
import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.model.LogHabitRequest
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

interface HabitRepository {
    fun getHabits(weekStart: String): Flow<List<HabitLogEntity>>
    suspend fun logHabit(
        habitName: String,
        category: String,
        pointsImpact: Int,
        notes: String?,
        weekStart: String
    ): Result<HabitLogEntity>
    suspend fun deleteHabit(id: String): Result<Unit>
    suspend fun seedDemoHabits(weekStart: String)
}

@Singleton
class HabitRepositoryImpl @Inject constructor(
    private val habitDao: HabitLogDao,
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) : HabitRepository {

    override fun getHabits(weekStart: String): Flow<List<HabitLogEntity>> {
        return habitDao.getHabitsForWeek(weekStart)
    }

    override suspend fun logHabit(
        habitName: String,
        category: String,
        pointsImpact: Int,
        notes: String?,
        weekStart: String
    ): Result<HabitLogEntity> = withContext(Dispatchers.IO) {
        val tempId = UUID.randomUUID().toString()
        val habitEntity = HabitLogEntity(
            id = tempId,
            weekStart = weekStart,
            habitName = habitName,
            category = category,
            pointsImpact = pointsImpact,
            notes = notes,
            loggedAt = java.time.Instant.now().toString(),
            isSyncPending = true
        )

        // Optimistic local save
        habitDao.upsertHabit(habitEntity)

        if (tokenManager.isDemoMode()) {
            val confirmed = habitEntity.copy(isSyncPending = false)
            habitDao.upsertHabit(confirmed)
            return@withContext Result.success(confirmed)
        }

        val request = LogHabitRequest(
            habitName = habitName,
            category = category,
            pointsImpact = pointsImpact,
            notes = notes,
            logTime = habitEntity.loggedAt
        )

        try {
            val response = apiService.logHabit(request)
            if (response.isSuccessful && response.body() != null) {
                val serverHabit = response.body()!!.habit
                val confirmed = habitEntity.copy(id = serverHabit.id, isSyncPending = false)
                habitDao.deleteHabit(tempId)
                habitDao.upsertHabit(confirmed)
                Result.success(confirmed)
            } else {
                enqueueMutation("habits/log", "POST", json.encodeToString(request))
                Result.success(habitEntity)
            }
        } catch (e: Exception) {
            enqueueMutation("habits/log", "POST", json.encodeToString(request))
            Result.success(habitEntity)
        }
    }

    override suspend fun deleteHabit(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        habitDao.deleteHabit(id)

        if (tokenManager.isDemoMode()) {
            return@withContext Result.success(Unit)
        }

        try {
            val response = apiService.deleteHabit(id)
            if (!response.isSuccessful) {
                enqueueMutation("habits/$id", "DELETE", "")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("habits/$id", "DELETE", "")
            Result.success(Unit)
        }
    }

    override suspend fun seedDemoHabits(weekStart: String) = withContext(Dispatchers.IO) {
        val demoHabits = listOf(
            HabitLogEntity(
                id = UUID.randomUUID().toString(),
                weekStart = weekStart,
                habitName = "Morning Hydration (500ml)",
                category = "Health",
                pointsImpact = 5,
                notes = "Electrolytes",
                loggedAt = java.time.Instant.now().toString(),
                isSyncPending = false
            ),
            HabitLogEntity(
                id = UUID.randomUUID().toString(),
                weekStart = weekStart,
                habitName = "Deep Work: 90min Focus",
                category = "Work",
                pointsImpact = 15,
                notes = null,
                loggedAt = java.time.Instant.now().toString(),
                isSyncPending = false
            )
        )
        habitDao.upsertHabits(demoHabits)
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
