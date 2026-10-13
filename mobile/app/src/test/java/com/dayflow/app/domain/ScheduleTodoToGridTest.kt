package com.dayflow.app.domain

import com.dayflow.app.data.local.CategoryDao
import com.dayflow.app.data.local.CategoryEntity
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.local.TodoDao
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.domain.model.Slot
import com.dayflow.app.domain.model.SlotStatus
import com.dayflow.app.domain.model.TodoFilter
import com.dayflow.app.domain.model.TodoPriority
import com.dayflow.app.domain.usecase.SaveSlotUseCase
import com.dayflow.app.domain.usecase.ScheduleTodoResult
import com.dayflow.app.domain.usecase.ScheduleTodoToGridUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

class ScheduleTodoToGridTest {

    private lateinit var fakeSlotDao: FakeScheduleSlotDao
    private lateinit var fakeTodoDao: FakeTodoDao
    private lateinit var fakeCategoryDao: FakeCategoryDao
    private lateinit var useCase: ScheduleTodoToGridUseCase

    private val testDate = LocalDate.of(2026, 10, 14)

    @Before
    fun setup() {
        fakeSlotDao = FakeScheduleSlotDao()
        fakeTodoDao = FakeTodoDao()
        fakeCategoryDao = FakeCategoryDao()

        val saveSlotUseCase = SaveSlotUseCase(
            scheduleRepository = FakeScheduleRepoForTodo(fakeSlotDao),
            slotDao = fakeSlotDao
        )

        useCase = ScheduleTodoToGridUseCase(
            slotDao = fakeSlotDao,
            todoDao = fakeTodoDao,
            categoryDao = fakeCategoryDao,
            saveSlotUseCase = saveSlotUseCase
        )
    }

    @Test
    fun testPriorityEnumParsingAndBadges() {
        assertEquals(TodoPriority.HIGH, TodoPriority.fromString("High"))
        assertEquals(TodoPriority.HIGH, TodoPriority.fromString("high"))
        assertEquals(TodoPriority.MEDIUM, TodoPriority.fromString("Medium"))
        assertEquals(TodoPriority.LOW, TodoPriority.fromString("Low"))
        assertEquals(TodoPriority.MEDIUM, TodoPriority.fromString("unknown")) // default fallback
    }

    @Test
    fun testCheckConflictOnEmptySlotReturnsNoConflict() = runBlocking {
        val (hasConflict, info) = useCase.checkConflict(testDate, "09:00")
        assertFalse(hasConflict)
        assertNull(info)
    }

    @Test
    fun testCheckConflictOnOccupiedSlotReturnsConflict() = runBlocking {
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_09:00",
                weekStart = "2026-10-12",
                plannedTask = "Important Meeting",
                actualTask = "Important Meeting",
                category = "Work"
            )
        )

        val (hasConflict, info) = useCase.checkConflict(testDate, "09:00")
        assertTrue(hasConflict)
        assertNotNull(info)
        assertEquals("Important Meeting", info!!.first)
        assertEquals("Work", info.second)
    }

    @Test
    fun testFindNextFreeSlotSkipsOccupiedSlots() = runBlocking {
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_09:00",
                weekStart = "2026-10-12",
                plannedTask = "Morning Standup",
                category = "Work"
            )
        )
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_09:30",
                weekStart = "2026-10-12",
                plannedTask = "Code Review",
                category = "Work"
            )
        )

        val nextFree = useCase.findNextFreeSlot(testDate, "09:00")
        assertEquals("10:00", nextFree)
    }

    @Test
    fun testScheduleTodoToGridSuccess() = runBlocking {
        val todo = TodoEntity(
            id = "todo_1",
            weekStart = "2026-10-12",
            title = "Write Documentation",
            priority = "High",
            category = "Work"
        )
        fakeTodoDao.upsertTodo(todo)

        val result = useCase.execute(
            todo = todo,
            date = testDate,
            timeStr = "11:00",
            forceOverwrite = false
        )

        assertTrue(result is ScheduleTodoResult.Success)
        val success = result as ScheduleTodoResult.Success
        assertEquals("2026-10-14_11:00", success.slotKey)

        // Verify slot was created
        val createdSlot = fakeSlotDao.getSlotByKey("2026-10-14_11:00")
        assertNotNull(createdSlot)
        assertEquals("Write Documentation", createdSlot!!.plannedTask)
        assertEquals("Work", createdSlot.category)

        // Verify todo entity updated with slot key
        val updatedTodo = fakeTodoDao.getTodoById("todo_1")
        assertEquals("2026-10-14_11:00", updatedTodo?.scheduledSlotKey)
    }

    @Test
    fun testScheduleTodoConflictWithoutOverwriteReturnsConflict() = runBlocking {
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_14:00",
                weekStart = "2026-10-12",
                plannedTask = "Architecture Sync",
                category = "Work"
            )
        )

        val todo = TodoEntity(
            id = "todo_2",
            weekStart = "2026-10-12",
            title = "Bug Fixing",
            priority = "Medium",
            category = "Work"
        )

        val result = useCase.execute(
            todo = todo,
            date = testDate,
            timeStr = "14:00",
            forceOverwrite = false
        )

        assertTrue(result is ScheduleTodoResult.Conflict)
        val conflict = result as ScheduleTodoResult.Conflict
        assertEquals("2026-10-14_14:00", conflict.slotKey)
        assertEquals("Architecture Sync", conflict.existingTask)
        assertEquals("14:30", conflict.suggestedFreeSlot)
    }

    @Test
    fun testScheduleTodoConflictWithForceOverwriteSucceeds() = runBlocking {
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_14:00",
                weekStart = "2026-10-12",
                plannedTask = "Architecture Sync",
                category = "Work"
            )
        )

        val todo = TodoEntity(
            id = "todo_2",
            weekStart = "2026-10-12",
            title = "Urgent Hotfix",
            priority = "High",
            category = "Work"
        )

        val result = useCase.execute(
            todo = todo,
            date = testDate,
            timeStr = "14:00",
            forceOverwrite = true
        )

        assertTrue(result is ScheduleTodoResult.Success)
        val overwrittenSlot = fakeSlotDao.getSlotByKey("2026-10-14_14:00")
        assertEquals("Urgent Hotfix", overwrittenSlot?.plannedTask)
    }

    @Test
    fun testUnscheduleTodoRemovesSlotAndClearsKey() = runBlocking {
        val todo = TodoEntity(
            id = "todo_3",
            weekStart = "2026-10-12",
            title = "Test Task",
            scheduledSlotKey = "2026-10-14_15:00"
        )
        fakeTodoDao.upsertTodo(todo)
        fakeSlotDao.upsertSlot(
            ScheduleSlotEntity(
                slotKey = "2026-10-14_15:00",
                weekStart = "2026-10-12",
                plannedTask = "Test Task"
            )
        )

        useCase.unschedule(todo)

        assertNull(fakeSlotDao.getSlotByKey("2026-10-14_15:00"))
        assertEquals(null, fakeTodoDao.getTodoById("todo_3")?.scheduledSlotKey)
    }
}

// ==========================================
// FAKE IMPLEMENTATIONS FOR TESTING
// ==========================================

class FakeScheduleSlotDao : ScheduleSlotDao {
    private val slots = mutableMapOf<String, ScheduleSlotEntity>()

    override fun getSlotsForWeek(weekStart: String): Flow<List<ScheduleSlotEntity>> =
        flowOf(slots.values.filter { it.weekStart == weekStart })

    override suspend fun getSlotByKey(slotKey: String): ScheduleSlotEntity? = slots[slotKey]

    override suspend fun upsertSlot(slot: ScheduleSlotEntity) {
        slots[slot.slotKey] = slot
    }

    override suspend fun upsertSlots(slotsList: List<ScheduleSlotEntity>) {
        slotsList.forEach { slots[it.slotKey] = it }
    }

    override suspend fun deleteSlot(slotKey: String) {
        slots.remove(slotKey)
    }

    override suspend fun clearWeek(weekStart: String) {
        slots.entries.removeIf { it.value.weekStart == weekStart }
    }
}

class FakeTodoDao : TodoDao {
    private val todos = mutableMapOf<String, TodoEntity>()

    override fun getTodosForWeek(weekStart: String): Flow<List<TodoEntity>> =
        flowOf(todos.values.filter { it.weekStart == weekStart })

    override suspend fun upsertTodo(todo: TodoEntity) {
        todos[todo.id] = todo
    }

    override suspend fun upsertTodos(todosList: List<TodoEntity>) {
        todosList.forEach { todos[it.id] = it }
    }

    override suspend fun updateCompletion(id: String, isCompleted: Boolean, isSyncPending: Boolean) {
        todos[id]?.let { todos[id] = it.copy(isCompleted = isCompleted) }
    }

    override suspend fun getTodoById(id: String): TodoEntity? = todos[id]

    override suspend fun updateScheduledSlot(id: String, slotKey: String?, isSyncPending: Boolean) {
        todos[id]?.let { todos[id] = it.copy(scheduledSlotKey = slotKey) }
    }

    override suspend fun deleteTodo(id: String) {
        todos.remove(id)
    }

    override suspend fun clearTodosForWeek(weekStart: String) {
        todos.entries.removeIf { it.value.weekStart == weekStart }
    }
}

class FakeCategoryDao : CategoryDao {
    private val categories = mutableListOf<CategoryEntity>()

    override fun getActiveCategories(): Flow<List<CategoryEntity>> = flowOf(categories)

    override suspend fun getActiveCategoriesSync(): List<CategoryEntity> = categories

    override suspend fun upsertCategories(categoriesList: List<CategoryEntity>) {
        categories.addAll(categoriesList)
    }

    override suspend fun upsertCategory(category: CategoryEntity) {
        categories.add(category)
    }

    override suspend fun archiveCategory(id: String, isSyncPending: Boolean) {
        categories.removeIf { it.id == id }
    }

    override suspend fun deleteCategory(id: String) {
        categories.removeIf { it.id == id }
    }

    override suspend fun clearCategories() {
        categories.clear()
    }
}

private class FakeScheduleRepoForTodo(private val slotDao: ScheduleSlotDao) : com.dayflow.app.data.repository.ScheduleRepository {
    override fun getWeekSchedule(weekStart: String) = flowOf(emptyList<ScheduleSlotEntity>())
    override suspend fun refreshWeekSchedule(weekStart: String) = Result.success(Unit)
    override suspend fun saveSlot(slot: ScheduleSlotEntity): Result<Unit> {
        slotDao.upsertSlot(slot)
        return Result.success(Unit)
    }
    override suspend fun deleteSlot(slotKey: String) = Result.success(Unit)
    override suspend fun seedDemoSchedule(weekStart: String) {}
}
