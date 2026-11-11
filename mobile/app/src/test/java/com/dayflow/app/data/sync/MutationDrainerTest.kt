package com.dayflow.app.data.sync

import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.MutationQueueEntity
import com.dayflow.app.data.model.AuthResponse
import com.dayflow.app.data.model.DayTemplateDto
import com.dayflow.app.data.model.TemplatesResponse
import com.dayflow.app.data.model.TemplateUpsertResponse
import com.dayflow.app.data.model.CategoriesResponse
import com.dayflow.app.data.model.CategoryDto
import com.dayflow.app.data.model.CreateTodoRequest
import com.dayflow.app.data.model.DeleteSlotRequest
import com.dayflow.app.data.model.DeleteAccountRequest
import com.dayflow.app.data.model.ForgotPasswordRequest
import com.dayflow.app.data.model.HabitLogDto
import com.dayflow.app.data.model.LogHabitRequest
import com.dayflow.app.data.model.LogHabitResponse
import com.dayflow.app.data.model.LoginRequest
import com.dayflow.app.data.model.MessageResponse
import com.dayflow.app.data.model.RegisterRequest
import com.dayflow.app.data.model.SaveNotesRequest
import com.dayflow.app.data.model.SaveSlotRequest
import com.dayflow.app.data.model.SaveSlotResponse
import com.dayflow.app.data.model.SlotDto
import com.dayflow.app.data.model.TodoItemDto
import com.dayflow.app.data.model.UpdateTodoRequest
import com.dayflow.app.data.model.UserProfileResponse
import com.dayflow.app.data.model.WeekScheduleResponse
import com.dayflow.app.data.model.WeekTodosResponse
import com.dayflow.app.data.remote.DayFlowApiService
import com.dayflow.app.data.remote.TokenManager
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import java.io.IOException

class MutationDrainerTest {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private lateinit var fakeDao: FakeMutationQueueDao
    private lateinit var fakeApiService: FakeDayFlowApiService
    private lateinit var fakeTokenManager: FakeTokenManager
    private lateinit var drainer: MutationDrainer

    @Before
    fun setup() {
        fakeDao = FakeMutationQueueDao()
        fakeApiService = FakeDayFlowApiService()
        fakeTokenManager = FakeTokenManager()
        drainer = MutationDrainer(fakeDao, fakeApiService, fakeTokenManager, json)
    }

    @Test
    fun testEmptyQueueReturnsSuccessZero() = runBlocking {
        val result = drainer.drain()
        assertTrue(result is DrainResult.Success)
        assertEquals(0, (result as DrainResult.Success).processedCount)
    }

    @Test
    fun testDemoModeClearsQueueImmediately() = runBlocking {
        fakeTokenManager.setDemoMode(true)
        fakeDao.enqueue(MutationQueueEntity(id = 1, endpoint = "schedule/slot", httpMethod = "POST", payloadJson = "{}"))

        val result = drainer.drain()
        assertTrue(result is DrainResult.Success)
        assertEquals(0, (result as DrainResult.Success).processedCount)
        assertTrue(fakeDao.getAllPendingMutations().isEmpty())
    }

    @Test
    fun testDrainProcessesAndDeletesSuccessfulMutations() = runBlocking {
        val saveRequest = SaveSlotRequest(
            weekStart = "2026-10-05",
            slotKey = "2026-10-05_09:00",
            plannedTask = "Offline Task",
            actualTask = "Offline Task",
            category = "Work"
        )
        fakeDao.enqueue(
            MutationQueueEntity(
                id = 10,
                endpoint = "schedule/slot",
                httpMethod = "POST",
                payloadJson = json.encodeToString(saveRequest)
            )
        )

        val result = drainer.drain()
        assertTrue(result is DrainResult.Success)
        assertEquals(1, (result as DrainResult.Success).processedCount)
        assertTrue(fakeDao.getAllPendingMutations().isEmpty())
        assertEquals(1, fakeApiService.savedSlots.size)
        assertEquals("Offline Task", fakeApiService.savedSlots[0].plannedTask)
    }

    @Test
    fun testPoisonPillMutationRemovedOnClientError() = runBlocking {
        fakeApiService.shouldFailWith400 = true
        fakeDao.enqueue(
            MutationQueueEntity(
                id = 99,
                endpoint = "schedule/slot",
                httpMethod = "POST",
                payloadJson = "{}"
            )
        )

        val result = drainer.drain()
        assertTrue(result is DrainResult.Success)
        assertTrue(fakeDao.getAllPendingMutations().isEmpty())
    }

    @Test
    fun testNetworkErrorHaltsQueueProcessing() = runBlocking {
        fakeApiService.shouldThrowNetworkError = true
        val validRequest = SaveSlotRequest(
            weekStart = "2026-10-05",
            slotKey = "2026-10-05_09:00",
            plannedTask = "Offline Task"
        )
        fakeDao.enqueue(
            MutationQueueEntity(
                id = 101,
                endpoint = "schedule/slot",
                httpMethod = "POST",
                payloadJson = json.encodeToString(validRequest)
            )
        )

        val result = drainer.drain()
        assertTrue(result is DrainResult.NetworkError)
        assertEquals(1, fakeDao.getAllPendingMutations().size)
    }
    @Test
    fun testDrainCategoryMutationProcessesSuccessfully() = runBlocking {
        val cat = CategoryDto(id = "c1", name = "Test Cat", color = "#ff0000", icon = "🎯")
        fakeDao.enqueue(
            MutationQueueEntity(
                id = 10,
                endpoint = "categories",
                httpMethod = "POST",
                payloadJson = json.encodeToString(cat)
            )
        )

        val result = drainer.drain()

        assertTrue(result is DrainResult.Success)
        assertEquals(1, (result as DrainResult.Success).processedCount)
        assertTrue(fakeDao.getAllPendingMutations().isEmpty())
    }
}

class FakeMutationQueueDao : MutationQueueDao {
    private val queue = mutableListOf<MutationQueueEntity>()
    private var nextId = 1L

    override suspend fun getAllPendingMutations(): List<MutationQueueEntity> {
        return queue.toList()
    }

    override suspend fun enqueue(mutation: MutationQueueEntity): Long {
        val assignedId = if (mutation.id > 0) mutation.id else nextId++
        queue.add(mutation.copy(id = assignedId))
        return assignedId
    }

    override suspend fun deleteMutation(id: Long) {
        queue.removeAll { it.id == id }
    }

    override suspend fun clearQueue() {
        queue.clear()
    }
}

class FakeTokenManager : TokenManager(null) {
    private var isDemo = false
    override fun saveToken(token: String) {}
    override fun getToken(): String? = "mock-token"
    override fun clearToken() {}
    override fun setDemoMode(isDemo: Boolean) { this.isDemo = isDemo }
    override fun isDemoMode(): Boolean = isDemo
}

class FakeDayFlowApiService : DayFlowApiService {
    var shouldFailWith400 = false
    var shouldThrowNetworkError = false
    val savedSlots = mutableListOf<SaveSlotRequest>()

    override suspend fun register(request: RegisterRequest): Response<AuthResponse> = TODO()
    override suspend fun login(request: LoginRequest): Response<AuthResponse> = TODO()
    override suspend fun googleLogin(request: com.dayflow.app.data.model.GoogleLoginRequest): Response<AuthResponse> = TODO()
    override suspend fun getAuthConfig(): Response<com.dayflow.app.data.model.AuthConfigResponse> = TODO()
    override suspend fun getCurrentUser(): Response<UserProfileResponse> = TODO()
    override suspend fun forgotPassword(request: ForgotPasswordRequest): Response<MessageResponse> = TODO()
    override suspend fun changePassword(request: com.dayflow.app.data.model.ChangePasswordRequest): Response<MessageResponse> = TODO()
    override suspend fun getWeekSchedule(weekStart: String): Response<WeekScheduleResponse> = TODO()

    override suspend fun saveSlot(request: SaveSlotRequest): Response<SaveSlotResponse> {
        if (shouldThrowNetworkError) throw IOException("Simulated network disconnection")
        if (shouldFailWith400) {
            return Response.error(400, "Bad Request".toResponseBody("application/json".toMediaType()))
        }
        savedSlots.add(request)
        return Response.success(
            SaveSlotResponse(
                message = "Saved",
                slot = SlotDto(
                    slotKey = request.slotKey,
                    plannedTask = request.plannedTask,
                    actualTask = request.actualTask,
                    category = request.category,
                    plannedDuration = request.plannedDuration,
                    actualDuration = request.actualDuration,
                    status = request.status,
                    notes = request.notes
                )
            )
        )
    }

    override suspend fun deleteSlot(request: DeleteSlotRequest): Response<MessageResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(MessageResponse("Deleted"))
    }

    override suspend fun logHabit(request: LogHabitRequest): Response<LogHabitResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(
            LogHabitResponse(
                message = "Logged",
                habit = HabitLogDto(
                    id = "h1",
                    habitName = request.habitName,
                    category = request.category,
                    pointsImpact = request.pointsImpact,
                    notes = request.notes,
                    logTime = "2026-10-05T09:00:00Z"
                )
            )
        )
    }

    override suspend fun deleteHabit(id: String): Response<MessageResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(MessageResponse("Deleted"))
    }

    override suspend fun getWeekTodos(weekStart: String): Response<WeekTodosResponse> = TODO()

    override suspend fun createTodo(request: CreateTodoRequest): Response<TodoItemDto> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(
            TodoItemDto(
                id = "t1",
                weekStart = request.weekStart,
                title = request.title,
                isCompleted = false
            )
        )
    }

    override suspend fun updateTodo(id: String, request: UpdateTodoRequest): Response<TodoItemDto> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(
            TodoItemDto(
                id = id,
                weekStart = "2026-10-05",
                title = "Todo",
                isCompleted = request.isCompleted ?: false
            )
        )
    }

    override suspend fun deleteTodo(id: String): Response<MessageResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(MessageResponse("Deleted"))
    }

    override suspend fun saveNotes(request: SaveNotesRequest): Response<MessageResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(MessageResponse("Saved"))
    }

    override suspend fun getCategories(): Response<CategoriesResponse> = TODO()

    override suspend fun createCategory(request: CategoryDto): Response<CategoryDto> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(request)
    }

    override suspend fun deleteCategory(id: String): Response<Unit> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(Unit)
    }
    override suspend fun getTemplates(): Response<TemplatesResponse> = TODO()

    override suspend fun createTemplate(request: DayTemplateDto): Response<TemplateUpsertResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(TemplateUpsertResponse(template = request))
    }

    override suspend fun updateTemplate(id: String, request: DayTemplateDto): Response<TemplateUpsertResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(TemplateUpsertResponse(template = request))
    }

    override suspend fun deleteTemplate(id: String): Response<Unit> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(Unit)
    }

    override suspend fun deleteAccount(request: DeleteAccountRequest): Response<MessageResponse> {
        if (shouldThrowNetworkError) throw IOException("Network error")
        return Response.success(MessageResponse("Account deleted"))
    }
}
