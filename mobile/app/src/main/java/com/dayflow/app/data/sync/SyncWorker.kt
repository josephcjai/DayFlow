package com.dayflow.app.data.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import java.time.LocalDate

@EntryPoint
@InstallIn(SingletonComponent::class)
interface SyncWorkerEntryPoint {
    fun mutationDrainer(): MutationDrainer
    fun scheduleRepository(): ScheduleRepository
    fun habitRepository(): HabitRepository
    fun todoRepository(): TodoRepository
    fun tokenManager(): TokenManager
}

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val WORK_NAME_PERIODIC = "dayflow_periodic_sync"
        const val WORK_NAME_ONETIME = "dayflow_onetime_sync"
        private const val TAG = "SyncWorker"
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "Starting DayFlow background synchronization...")

        val hiltEntryPoint = EntryPointAccessors.fromApplication(
            applicationContext,
            SyncWorkerEntryPoint::class.java
        )

        val tokenManager = hiltEntryPoint.tokenManager()
        val token = tokenManager.getToken()

        if (token.isNullOrBlank() && !tokenManager.isDemoMode()) {
            Log.d(TAG, "User not authenticated; skipping sync.")
            return Result.success()
        }

        val mutationDrainer = hiltEntryPoint.mutationDrainer()
        val scheduleRepo = hiltEntryPoint.scheduleRepository()
        val habitRepo = hiltEntryPoint.habitRepository()
        val todoRepo = hiltEntryPoint.todoRepository()

        val drainResult = mutationDrainer.drain()
        if (drainResult is DrainResult.NetworkError) {
            Log.w(TAG, "Network error draining mutations. Scheduling retry.")
            return Result.retry()
        }

        val currentWeekStart = DateTimeUtils.getWeekKey(LocalDate.now())
        try {
            scheduleRepo.refreshWeekSchedule(currentWeekStart)
            habitRepo.getHabits(currentWeekStart)
            todoRepo.refreshTodos(currentWeekStart)
        } catch (e: Exception) {
            Log.w(TAG, "Error refreshing week data after drain: ${e.message}")
        }

        Log.d(TAG, "DayFlow synchronization completed successfully.")
        return Result.success()
    }
}
