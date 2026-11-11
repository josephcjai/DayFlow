package com.dayflow.app.data.sync

import android.util.Log
import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.model.CategoryDto
import com.dayflow.app.data.model.DayTemplateDto
import com.dayflow.app.data.model.CreateTodoRequest
import com.dayflow.app.data.model.DeleteSlotRequest
import com.dayflow.app.data.model.LogHabitRequest
import com.dayflow.app.data.model.SaveNotesRequest
import com.dayflow.app.data.model.SaveSlotRequest
import com.dayflow.app.data.model.UpdateTodoRequest
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.util.DateTimeUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

sealed class DrainResult {
    data class Success(val processedCount: Int) : DrainResult()
    data class NetworkError(val error: Throwable) : DrainResult()
    data class PartialSuccess(val processedCount: Int, val failedError: Throwable) : DrainResult()
}

@Singleton
class MutationDrainer @Inject constructor(
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) {
    companion object {
        private const val TAG = "MutationDrainer"
    }

    suspend fun drain(): DrainResult = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) {
            mutationQueueDao.clearQueue()
            return@withContext DrainResult.Success(0)
        }

        val pending = mutationQueueDao.getAllPendingMutations()
        if (pending.isEmpty()) {
            return@withContext DrainResult.Success(0)
        }

        var processedCount = 0

        for (mutation in pending) {
            try {
                val success = processMutation(mutation)
                if (success) {
                    mutationQueueDao.deleteMutation(mutation.id)
                    processedCount++
                } else {
                    // Non-fatal client error (4xx) - discard poison pill
                    mutationQueueDao.deleteMutation(mutation.id)
                    Log.w(TAG, "Poison pill mutation discarded: ${mutation.endpoint}")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Network failure while draining mutation queue", e)
                return@withContext if (processedCount > 0) {
                    DrainResult.PartialSuccess(processedCount, e)
                } else {
                    DrainResult.NetworkError(e)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Unexpected error processing mutation", e)
                mutationQueueDao.deleteMutation(mutation.id)
            }
        }

        DrainResult.Success(processedCount)
    }

    private suspend fun processMutation(mutation: MutationQueueEntity): Boolean {
        val endpoint = mutation.endpoint
        val method = mutation.httpMethod
        val payload = mutation.payloadJson

        return when {
            // Schedule slot mutations
            endpoint == "schedule/slot" && method == "POST" -> {
                val req = json.decodeFromString<SaveSlotRequest>(payload)
                val resp = apiService.saveSlot(req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint == "schedule/slot" && method == "DELETE" -> {
                val req = json.decodeFromString<DeleteSlotRequest>(payload)
                val normalizedReq = if (req.weekStart.isNullOrBlank()) {
                    val (slotDate, _) = DateTimeUtils.parseSlotKey(req.slotKey)
                    req.copy(weekStart = DateTimeUtils.getWeekKey(slotDate))
                } else {
                    req
                }
                val resp = apiService.deleteSlot(normalizedReq)
                resp.isSuccessful || resp.code() in 400..499
            }

            // Habit mutations
            endpoint == "habits/log" && method == "POST" -> {
                val req = json.decodeFromString<LogHabitRequest>(payload)
                val resp = apiService.logHabit(req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("habits/") && method == "DELETE" -> {
                val habitId = endpoint.removePrefix("habits/")
                val resp = apiService.deleteHabit(habitId)
                resp.isSuccessful || resp.code() in 400..499
            }

            // Todo mutations
            endpoint == "todos/todo" && method == "POST" -> {
                val req = json.decodeFromString<CreateTodoRequest>(payload)
                val resp = apiService.createTodo(req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("todos/") && method == "PATCH" -> {
                val todoId = endpoint.removePrefix("todos/")
                val req = json.decodeFromString<UpdateTodoRequest>(payload)
                val resp = apiService.updateTodo(todoId, req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("todos/") && method == "DELETE" -> {
                val todoId = endpoint.removePrefix("todos/")
                val resp = apiService.deleteTodo(todoId)
                resp.isSuccessful || resp.code() in 400..499
            }
            // Category mutations
            endpoint == "categories" && method == "POST" -> {
                val req = json.decodeFromString<CategoryDto>(payload)
                val resp = apiService.createCategory(req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("categories/") && method == "DELETE" -> {
                val catId = endpoint.removePrefix("categories/")
                val resp = apiService.deleteCategory(catId)
                resp.isSuccessful || resp.code() in 400..499
            }

            endpoint == "todos/notes" && method == "POST" -> {
                val req = json.decodeFromString<SaveNotesRequest>(payload)
                val resp = apiService.saveNotes(req)
                resp.isSuccessful || resp.code() in 400..499
            }

            // Template mutations
            endpoint == "templates" && method == "POST" -> {
                val req = json.decodeFromString<DayTemplateDto>(payload)
                val resp = apiService.createTemplate(req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("templates/") && method == "PUT" -> {
                val templateId = endpoint.removePrefix("templates/")
                val req = json.decodeFromString<DayTemplateDto>(payload)
                val resp = apiService.updateTemplate(templateId, req)
                resp.isSuccessful || resp.code() in 400..499
            }
            endpoint.startsWith("templates/") && method == "DELETE" -> {
                val templateId = endpoint.removePrefix("templates/")
                val resp = apiService.deleteTemplate(templateId)
                resp.isSuccessful || resp.code() in 400..499
            }

            else -> {
                Log.w(TAG, "Unknown mutation endpoint/method: $method $endpoint")
                true
            }
        }
    }
}
