package com.dayflow.app.domain

import com.dayflow.app.data.local.CategoryDao
import com.dayflow.app.data.local.CategoryEntity
import com.dayflow.app.data.local.DayFlowDatabase
import com.dayflow.app.data.local.DayTemplateDao
import com.dayflow.app.data.local.DayTemplateEntity
import com.dayflow.app.data.local.HabitLogDao
import com.dayflow.app.data.local.HabitLogEntity
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.local.TodoDao
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.local.WeeklyNotesDao
import com.dayflow.app.data.local.WeeklyNotesEntity
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.BackupRepositoryImpl
import com.dayflow.app.domain.util.DateTimeUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalTime

class Phase15BackupAndSettingsTest {

    // =========================================================================
    // 1. Time Format Logic Tests (12h vs 24h Parity)
    // =========================================================================

    @Test
    fun `formatTimeLabel correctly formats 24-hour military time`() {
        val midnight = LocalTime.of(0, 0)
        val morning = LocalTime.of(9, 30)
        val noon = LocalTime.of(12, 0)
        val evening = LocalTime.of(23, 30)

        assertEquals("00:00", DateTimeUtils.formatTimeLabel(midnight, is24Hour = true))
        assertEquals("09:30", DateTimeUtils.formatTimeLabel(morning, is24Hour = true))
        assertEquals("12:00", DateTimeUtils.formatTimeLabel(noon, is24Hour = true))
        assertEquals("23:30", DateTimeUtils.formatTimeLabel(evening, is24Hour = true))
    }

    @Test
    fun `formatTimeLabel correctly formats 12-hour AM-PM time matching Web formatTimeLabel`() {
        val midnight = LocalTime.of(0, 0)
        val morning = LocalTime.of(9, 30)
        val noon = LocalTime.of(12, 0)
        val afternoon = LocalTime.of(13, 30)
        val night = LocalTime.of(23, 30)

        assertEquals("12:00 AM", DateTimeUtils.formatTimeLabel(midnight, is24Hour = false))
        assertEquals("09:30 AM", DateTimeUtils.formatTimeLabel(morning, is24Hour = false))
        assertEquals("12:00 PM", DateTimeUtils.formatTimeLabel(noon, is24Hour = false))
        assertEquals("01:30 PM", DateTimeUtils.formatTimeLabel(afternoon, is24Hour = false))
        assertEquals("11:30 PM", DateTimeUtils.formatTimeLabel(night, is24Hour = false))
    }

    // =========================================================================
    // 2. Token Preferences State Tests
    // =========================================================================

    @Test
    fun `FakeTokenManager defaults to 12h and emits reactive format changes`() = runTest {
        val fakeTokenManager = FakeTokenManager()

        assertEquals("12h", fakeTokenManager.getTimeFormat())
        assertEquals("12h", fakeTokenManager.timeFormatFlow.value)

        fakeTokenManager.setTimeFormat("24h")
        assertEquals("24h", fakeTokenManager.getTimeFormat())
        assertEquals("24h", fakeTokenManager.timeFormatFlow.value)

        fakeTokenManager.setTimeFormat("12h")
        assertEquals("12h", fakeTokenManager.getTimeFormat())
        assertEquals("12h", fakeTokenManager.timeFormatFlow.value)
    }

    @Test
    fun `FakeTokenManager toggles biometric security preference`() {
        val fakeTokenManager = FakeTokenManager()

        assertFalse(fakeTokenManager.isBiometricsEnabled())
        fakeTokenManager.setBiometricsEnabled(true)
        assertTrue(fakeTokenManager.isBiometricsEnabled())
        fakeTokenManager.setBiometricsEnabled(false)
        assertFalse(fakeTokenManager.isBiometricsEnabled())
    }

    // =========================================================================
    // 3. Backup JSON Inspection & Cross-Platform Restore Tests
    // =========================================================================

    @Test
    fun `inspectBackupJson parses direct Android JSON backup format`() = runTest {
        val fakeTokenManager = FakeTokenManager()
        val repo = BackupRepositoryImpl(
            database = null,
            scheduleSlotDao = FakeScheduleSlotDaoImpl(),
            habitLogDao = FakeHabitLogDaoImpl(),
            todoDao = FakeTodoDaoImpl(),
            weeklyNotesDao = FakeWeeklyNotesDaoImpl(),
            categoryDao = FakeCategoryDaoImpl(),
            dayTemplateDao = FakeDayTemplateDaoImpl(),
            tokenManager = fakeTokenManager
        )

        val json = """
        {
            "exportDate": "2026-10-13T12:00:00Z",
            "version": "2.9.0",
            "platform": "Android",
            "slots": [
                {"slotKey": "2026-10-13_09:00", "plannedTask": "Deep Work", "category": "Work"}
            ],
            "habits": [
                {"id": "h1", "habitName": "Morning Workout", "pointsImpact": 10}
            ],
            "todos": [
                {"id": "t1", "title": "Submit PR", "isCompleted": false}
            ],
            "categories": [
                {"id": "c1", "name": "Deep Work", "icon": "💻"}
            ]
        }
        """.trimIndent()

        val inspection = repo.inspectBackupJson(json)
        assertTrue(inspection.isValid)
        assertEquals(1, inspection.slotCount)
        assertEquals(1, inspection.habitCount)
        assertEquals(1, inspection.todoCount)
        assertEquals(1, inspection.categoryCount)
    }

    @Test
    fun `inspectBackupJson parses Web App scheduleData format for cross-platform restore`() = runTest {
        val fakeTokenManager = FakeTokenManager()
        val repo = BackupRepositoryImpl(
            database = null,
            scheduleSlotDao = FakeScheduleSlotDaoImpl(),
            habitLogDao = FakeHabitLogDaoImpl(),
            todoDao = FakeTodoDaoImpl(),
            weeklyNotesDao = FakeWeeklyNotesDaoImpl(),
            categoryDao = FakeCategoryDaoImpl(),
            dayTemplateDao = FakeDayTemplateDaoImpl(),
            tokenManager = fakeTokenManager
        )

        val webJson = """
        {
            "exportDate": "2026-10-13T10:00:00Z",
            "version": "2.9.0",
            "scheduleData": {
                "2026-10-12": {
                    "slots": {
                        "2026-10-12_09:00": { "plannedTask": "Design System Review", "category": "Work" },
                        "2026-10-12_09:30": { "plannedTask": "Architecture Sync", "category": "Work" }
                    },
                    "habits": [
                        { "id": "h-web-1", "habitName": "Hydration", "pointsImpact": 5 }
                    ],
                    "todos": [
                        { "id": "t-web-1", "title": "Review Parity Spec", "isCompleted": true }
                    ],
                    "notes": "Weekly strategic goals"
                }
            }
        }
        """.trimIndent()

        val inspection = repo.inspectBackupJson(webJson)
        assertTrue(inspection.isValid)
        assertEquals(2, inspection.slotCount)
        assertEquals(1, inspection.habitCount)
        assertEquals(1, inspection.todoCount)
        assertEquals(1, inspection.notesCount)
    }

    @Test
    fun `inspectBackupJson rejects corrupted or empty JSON payload`() = runTest {
        val fakeTokenManager = FakeTokenManager()
        val repo = BackupRepositoryImpl(
            database = null,
            scheduleSlotDao = FakeScheduleSlotDaoImpl(),
            habitLogDao = FakeHabitLogDaoImpl(),
            todoDao = FakeTodoDaoImpl(),
            weeklyNotesDao = FakeWeeklyNotesDaoImpl(),
            categoryDao = FakeCategoryDaoImpl(),
            dayTemplateDao = FakeDayTemplateDaoImpl(),
            tokenManager = fakeTokenManager
        )

        val invalidJson = "{ corrupt json payload"
        val inspection1 = repo.inspectBackupJson(invalidJson)
        assertFalse(inspection1.isValid)

        val emptyJson = "{}"
        val inspection2 = repo.inspectBackupJson(emptyJson)
        assertFalse(inspection2.isValid)
    }
}

// ==========================================
// PURE KOTLIN TEST FAKES (NO MOCKK NEEDED)
// ==========================================

private class FakeTokenManager : TokenManager(null) {
    private var format = "12h"
    private var biometrics = false
    private val _flow = MutableStateFlow("12h")
    override val timeFormatFlow: StateFlow<String> = _flow.asStateFlow()

    override fun getTimeFormat(): String = format
    override fun setTimeFormat(format: String) {
        this.format = format
        _flow.value = format
    }

    override fun isBiometricsEnabled(): Boolean = biometrics
    override fun setBiometricsEnabled(enabled: Boolean) {
        this.biometrics = enabled
    }

    override fun getUserEmail(): String? = "test@dayflow.app"
    override fun getDisplayName(): String? = "Test User"
    override fun isNotificationsEnabled(): Boolean = true
    override fun isActiveWindowEnabled(): Boolean = true
    override fun getNotifyStartHour(): Int = 8
    override fun getNotifyEndHour(): Int = 22
    override fun isMuteWeekends(): Boolean = false
    override fun isOnlyProductive(): Boolean = false
}



private class FakeScheduleSlotDaoImpl : ScheduleSlotDao {
    private val slots = mutableMapOf<String, ScheduleSlotEntity>()
    override fun getSlotsForWeek(weekStart: String): Flow<List<ScheduleSlotEntity>> = emptyFlow()
    override suspend fun getAllSlots(): List<ScheduleSlotEntity> = slots.values.toList()
    override suspend fun getSlotByKey(slotKey: String): ScheduleSlotEntity? = slots[slotKey]
    override suspend fun upsertSlot(slot: ScheduleSlotEntity) { slots[slot.slotKey] = slot }
    override suspend fun upsertSlots(slots: List<ScheduleSlotEntity>) { slots.forEach { this.slots[it.slotKey] = it } }
    override suspend fun deleteSlot(slotKey: String) { slots.remove(slotKey) }
    override suspend fun clearWeek(weekStart: String) { slots.values.removeIf { it.weekStart == weekStart } }
    override suspend fun clearAllSlots() { slots.clear() }
}

private class FakeHabitLogDaoImpl : HabitLogDao {
    private val habits = mutableMapOf<String, HabitLogEntity>()
    override fun getHabitsForWeek(weekStart: String): Flow<List<HabitLogEntity>> = emptyFlow()
    override suspend fun getAllHabits(): List<HabitLogEntity> = habits.values.toList()
    override suspend fun upsertHabit(habit: HabitLogEntity) { habits[habit.id] = habit }
    override suspend fun upsertHabits(habits: List<HabitLogEntity>) { habits.forEach { this.habits[it.id] = it } }
    override suspend fun deleteHabit(id: String) { habits.remove(id) }
    override suspend fun clearHabitsForWeek(weekStart: String) { habits.values.removeIf { it.weekStart == weekStart } }
    override suspend fun clearAllHabits() { habits.clear() }
}

private class FakeTodoDaoImpl : TodoDao {
    private val todos = mutableMapOf<String, TodoEntity>()
    override fun getTodosForWeek(weekStart: String): Flow<List<TodoEntity>> = emptyFlow()
    override suspend fun getAllTodos(): List<TodoEntity> = todos.values.toList()
    override suspend fun upsertTodo(todo: TodoEntity) { todos[todo.id] = todo }
    override suspend fun upsertTodos(todos: List<TodoEntity>) { todos.forEach { this.todos[it.id] = it } }
    override suspend fun updateCompletion(id: String, isCompleted: Boolean, isSyncPending: Boolean) { todos[id]?.let { todos[id] = it.copy(isCompleted = isCompleted) } }
    override suspend fun getTodoById(id: String): TodoEntity? = todos[id]
    override suspend fun updateScheduledSlot(id: String, slotKey: String?, isSyncPending: Boolean) { todos[id]?.let { todos[id] = it.copy(scheduledSlotKey = slotKey) } }
    override suspend fun deleteTodo(id: String) { todos.remove(id) }
    override suspend fun clearTodosForWeek(weekStart: String) { todos.values.removeIf { it.weekStart == weekStart } }
    override suspend fun clearAllTodos() { todos.clear() }
}

private class FakeWeeklyNotesDaoImpl : WeeklyNotesDao {
    private val notes = mutableMapOf<String, WeeklyNotesEntity>()
    override fun getNotesForWeek(weekStart: String): Flow<WeeklyNotesEntity?> = emptyFlow()
    override suspend fun getAllNotes(): List<WeeklyNotesEntity> = notes.values.toList()
    override suspend fun upsertNotes(notes: WeeklyNotesEntity) { this.notes[notes.weekStart] = notes }
    override suspend fun upsertNotesList(notes: List<WeeklyNotesEntity>) { notes.forEach { this.notes[it.weekStart] = it } }
    override suspend fun clearAllNotes() { notes.clear() }
}

private class FakeCategoryDaoImpl : CategoryDao {
    private val categories = mutableListOf<CategoryEntity>()
    override fun getActiveCategories(): Flow<List<CategoryEntity>> = emptyFlow()
    override suspend fun getActiveCategoriesSync(): List<CategoryEntity> = categories
    override suspend fun getAllCategories(): List<CategoryEntity> = categories
    override suspend fun upsertCategories(categories: List<CategoryEntity>) { this.categories.addAll(categories) }
    override suspend fun upsertCategory(category: CategoryEntity) { this.categories.add(category) }
    override suspend fun archiveCategory(id: String, isSyncPending: Boolean) { categories.removeIf { it.id == id } }
    override suspend fun deleteCategory(id: String) { categories.removeIf { it.id == id } }
    override suspend fun clearCategories() { categories.clear() }
}

private class FakeDayTemplateDaoImpl : DayTemplateDao {
    private val templates = mutableListOf<DayTemplateEntity>()
    override fun getAllTemplates(): Flow<List<DayTemplateEntity>> = emptyFlow()
    override suspend fun getAllTemplatesSync(): List<DayTemplateEntity> = templates
    override suspend fun getTemplateById(id: String): DayTemplateEntity? = templates.find { it.id == id }
    override suspend fun upsertTemplate(template: DayTemplateEntity) { templates.add(template) }
    override suspend fun upsertTemplates(templates: List<DayTemplateEntity>) { this.templates.addAll(templates) }
    override suspend fun deleteTemplate(id: String) { templates.removeIf { it.id == id } }
    override suspend fun clearTemplates() { templates.clear() }
}
