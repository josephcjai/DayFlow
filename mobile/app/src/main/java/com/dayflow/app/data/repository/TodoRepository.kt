package com.dayflow.app.data.repository

import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.local.TodoDao
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.local.WeeklyNotesDao
import com.dayflow.app.data.local.WeeklyNotesEntity
import com.dayflow.app.data.model.CreateTodoRequest
import com.dayflow.app.data.model.SaveNotesRequest
import com.dayflow.app.data.model.UpdateTodoRequest
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

interface TodoRepository {
    fun getTodos(weekStart: String): Flow<List<TodoEntity>>
    fun getNotes(weekStart: String): Flow<String?>
    suspend fun refreshTodos(weekStart: String): Result<Unit>
    suspend fun createTodo(weekStart: String, title: String, priority: String = "Medium", category: String = "General"): Result<TodoEntity>
    suspend fun updateScheduledSlot(id: String, slotKey: String?): Result<Unit>
    suspend fun toggleTodo(id: String, isCompleted: Boolean): Result<Unit>
    suspend fun deleteTodo(id: String): Result<Unit>
    suspend fun saveNotes(weekStart: String, notes: String): Result<Unit>
    suspend fun seedDemoTodos(weekStart: String)
}

@Singleton
class TodoRepositoryImpl @Inject constructor(
    private val todoDao: TodoDao,
    private val weeklyNotesDao: WeeklyNotesDao,
    private val mutationQueueDao: MutationQueueDao,
    private val apiService: DayFlowApiService,
    private val tokenManager: TokenManager,
    private val json: Json
) : TodoRepository {

    override fun getTodos(weekStart: String): Flow<List<TodoEntity>> {
        return todoDao.getTodosForWeek(weekStart)
    }

    override fun getNotes(weekStart: String): Flow<String?> {
        return weeklyNotesDao.getNotesForWeek(weekStart).map { it?.notes }
    }

    override suspend fun refreshTodos(weekStart: String): Result<Unit> = withContext(Dispatchers.IO) {
        if (tokenManager.isDemoMode()) return@withContext Result.success(Unit)

        try {
            val response = apiService.getWeekTodos(weekStart)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!
                val todoEntities = data.todos.map {
                    TodoEntity(
                        id = it.id,
                        weekStart = weekStart,
                        title = it.title,
                        isCompleted = it.isCompleted,
                        priority = it.priority.ifBlank { "Medium" },
                        category = it.category.ifBlank { "General" },
                        scheduledSlotKey = null,
                        isSyncPending = false
                    )
                }
                todoDao.upsertTodos(todoEntities)
                if (data.notes != null) {
                    weeklyNotesDao.upsertNotes(
                        WeeklyNotesEntity(
                            weekStart = weekStart,
                            notes = data.notes,
                            isSyncPending = false
                        )
                    )
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch todos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun createTodo(
        weekStart: String,
        title: String,
        priority: String,
        category: String
    ): Result<TodoEntity> = withContext(Dispatchers.IO) {
        val tempId = UUID.randomUUID().toString()
        val todo = TodoEntity(
            id = tempId,
            weekStart = weekStart,
            title = title.trim(),
            isCompleted = false,
            priority = priority,
            category = category,
            scheduledSlotKey = null,
            isSyncPending = true
        )
        todoDao.upsertTodo(todo)

        if (tokenManager.isDemoMode()) {
            val confirmed = todo.copy(isSyncPending = false)
            todoDao.upsertTodo(confirmed)
            return@withContext Result.success(confirmed)
        }

        val request = CreateTodoRequest(weekStart = weekStart, title = title.trim())
        try {
            val response = apiService.createTodo(request)
            if (response.isSuccessful && response.body() != null) {
                val serverTodo = response.body()!!
                val confirmed = todo.copy(id = serverTodo.id, isSyncPending = false)
                todoDao.deleteTodo(tempId)
                todoDao.upsertTodo(confirmed)
                Result.success(confirmed)
            } else {
                enqueueMutation("todos/todo", "POST", json.encodeToString(request))
                Result.success(todo)
            }
        } catch (e: Exception) {
            enqueueMutation("todos/todo", "POST", json.encodeToString(request))
            Result.success(todo)
        }
    }

    override suspend fun updateScheduledSlot(id: String, slotKey: String?): Result<Unit> = withContext(Dispatchers.IO) {
        todoDao.updateScheduledSlot(id, slotKey, isSyncPending = false)
        Result.success(Unit)
    }

    override suspend fun toggleTodo(id: String, isCompleted: Boolean): Result<Unit> = withContext(Dispatchers.IO) {
        todoDao.updateCompletion(id, isCompleted, isSyncPending = true)

        if (tokenManager.isDemoMode()) {
            todoDao.updateCompletion(id, isCompleted, isSyncPending = false)
            return@withContext Result.success(Unit)
        }

        val request = UpdateTodoRequest(isCompleted = isCompleted)
        try {
            val response = apiService.updateTodo(id, request)
            if (response.isSuccessful) {
                todoDao.updateCompletion(id, isCompleted, isSyncPending = false)
            } else {
                enqueueMutation("todos/$id", "PATCH", json.encodeToString(request))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("todos/$id", "PATCH", json.encodeToString(request))
            Result.success(Unit)
        }
    }

    override suspend fun deleteTodo(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        todoDao.deleteTodo(id)

        if (tokenManager.isDemoMode()) return@withContext Result.success(Unit)

        try {
            val response = apiService.deleteTodo(id)
            if (!response.isSuccessful) {
                enqueueMutation("todos/$id", "DELETE", "")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("todos/$id", "DELETE", "")
            Result.success(Unit)
        }
    }

    override suspend fun saveNotes(weekStart: String, notes: String): Result<Unit> = withContext(Dispatchers.IO) {
        weeklyNotesDao.upsertNotes(
            WeeklyNotesEntity(
                weekStart = weekStart,
                notes = notes,
                isSyncPending = true
            )
        )

        if (tokenManager.isDemoMode()) {
            weeklyNotesDao.upsertNotes(
                WeeklyNotesEntity(
                    weekStart = weekStart,
                    notes = notes,
                    isSyncPending = false
                )
            )
            return@withContext Result.success(Unit)
        }

        val request = SaveNotesRequest(weekStart = weekStart, notes = notes)
        try {
            val response = apiService.saveNotes(request)
            if (response.isSuccessful) {
                weeklyNotesDao.upsertNotes(
                    WeeklyNotesEntity(
                        weekStart = weekStart,
                        notes = notes,
                        isSyncPending = false
                    )
                )
            } else {
                enqueueMutation("todos/notes", "POST", json.encodeToString(request))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            enqueueMutation("todos/notes", "POST", json.encodeToString(request))
            Result.success(Unit)
        }
    }

    override suspend fun seedDemoTodos(weekStart: String) = withContext(Dispatchers.IO) {
        val sampleTodos = listOf(
            TodoEntity(
                id = UUID.randomUUID().toString(),
                weekStart = weekStart,
                title = "Ship DayFlow Mobile Alpha",
                isCompleted = false,
                isSyncPending = false
            ),
            TodoEntity(
                id = UUID.randomUUID().toString(),
                weekStart = weekStart,
                title = "Review 30-min schedule baseline time-locks",
                isCompleted = true,
                isSyncPending = false
            )
        )
        todoDao.upsertTodos(sampleTodos)
        weeklyNotesDao.upsertNotes(
            WeeklyNotesEntity(
                weekStart = weekStart,
                notes = "Focus this week: Consistent time-blocking & zero missed slots.",
                isSyncPending = false
            )
        )
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
