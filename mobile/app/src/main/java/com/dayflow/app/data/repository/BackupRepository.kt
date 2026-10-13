package com.dayflow.app.data.repository

import androidx.room.withTransaction
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class BackupInspectionResult(
    val isValid: Boolean,
    val errorMessage: String? = null,
    val exportDate: String = "",
    val slotCount: Int = 0,
    val habitCount: Int = 0,
    val todoCount: Int = 0,
    val notesCount: Int = 0,
    val categoryCount: Int = 0,
    val templateCount: Int = 0
)

data class BackupRestoreResult(
    val slotCount: Int,
    val habitCount: Int,
    val todoCount: Int,
    val notesCount: Int,
    val categoryCount: Int,
    val templateCount: Int
)

interface BackupRepository {
    suspend fun exportBackupJson(): String
    suspend fun inspectBackupJson(jsonString: String): BackupInspectionResult
    suspend fun restoreBackupJson(jsonString: String, wipeExisting: Boolean = false): Result<BackupRestoreResult>
}

@Singleton
class BackupRepositoryImpl @Inject constructor(
    private val database: DayFlowDatabase?,
    private val scheduleSlotDao: ScheduleSlotDao,
    private val habitLogDao: HabitLogDao,
    private val todoDao: TodoDao,
    private val weeklyNotesDao: WeeklyNotesDao,
    private val categoryDao: CategoryDao,
    private val dayTemplateDao: DayTemplateDao,
    private val tokenManager: TokenManager
) : BackupRepository {

    override suspend fun exportBackupJson(): String = withContext(Dispatchers.IO) {
        val slots = scheduleSlotDao.getAllSlots()
        val habits = habitLogDao.getAllHabits()
        val todos = todoDao.getAllTodos()
        val notes = weeklyNotesDao.getAllNotes()
        val categories = categoryDao.getAllCategories()
        val templates = dayTemplateDao.getAllTemplatesSync()

        val root = JSONObject()
        val nowIso = Instant.now().toString()
        root.put("exportDate", nowIso)
        root.put("version", "2.9.0")
        root.put("platform", "Android")

        // User info
        val userObj = JSONObject()
        userObj.put("email", tokenManager.getUserEmail() ?: "user@dayflow.app")
        userObj.put("displayName", tokenManager.getDisplayName() ?: "DayFlow User")
        root.put("user", userObj)

        // Settings
        val settingsObj = JSONObject()
        settingsObj.put("timeFormat", tokenManager.getTimeFormat())
        settingsObj.put("notificationsEnabled", tokenManager.isNotificationsEnabled())
        settingsObj.put("activeWindowEnabled", tokenManager.isActiveWindowEnabled())
        settingsObj.put("startHour", tokenManager.getNotifyStartHour())
        settingsObj.put("endHour", tokenManager.getNotifyEndHour())
        settingsObj.put("muteWeekends", tokenManager.isMuteWeekends())
        settingsObj.put("onlyProductive", tokenManager.isOnlyProductive())
        settingsObj.put("biometricsEnabled", tokenManager.isBiometricsEnabled())
        root.put("settings", settingsObj)

        // Direct Arrays
        val slotsArr = JSONArray()
        slots.forEach { s ->
            val o = JSONObject()
            o.put("slotKey", s.slotKey)
            o.put("weekStart", s.weekStart)
            o.put("plannedTask", s.plannedTask)
            o.put("actualTask", s.actualTask)
            o.put("category", s.category)
            o.put("plannedDuration", s.plannedDuration)
            o.put("actualDuration", s.actualDuration)
            o.put("status", s.status)
            o.put("notes", s.notes ?: "")
            if (s.isProductive != null) o.put("isProductive", s.isProductive)
            o.put("updatedAt", s.updatedAt)
            slotsArr.put(o)
        }
        root.put("slots", slotsArr)

        val habitsArr = JSONArray()
        habits.forEach { h ->
            val o = JSONObject()
            o.put("id", h.id)
            o.put("weekStart", h.weekStart)
            o.put("habitName", h.habitName)
            o.put("category", h.category)
            o.put("pointsImpact", h.pointsImpact)
            o.put("notes", h.notes ?: "")
            o.put("loggedAt", h.loggedAt)
            habitsArr.put(o)
        }
        root.put("habits", habitsArr)

        val todosArr = JSONArray()
        todos.forEach { t ->
            val o = JSONObject()
            o.put("id", t.id)
            o.put("weekStart", t.weekStart)
            o.put("title", t.title)
            o.put("isCompleted", t.isCompleted)
            o.put("priority", t.priority)
            o.put("category", t.category)
            o.put("scheduledSlotKey", t.scheduledSlotKey ?: "")
            todosArr.put(o)
        }
        root.put("todos", todosArr)

        val notesArr = JSONArray()
        notes.forEach { n ->
            val o = JSONObject()
            o.put("weekStart", n.weekStart)
            o.put("notes", n.notes)
            notesArr.put(o)
        }
        root.put("weeklyNotes", notesArr)

        val catsArr = JSONArray()
        categories.forEach { c ->
            val o = JSONObject()
            o.put("id", c.id)
            o.put("name", c.name)
            o.put("icon", c.icon)
            o.put("color", c.color)
            o.put("isProductive", c.isProductive)
            o.put("isSystem", c.isSystem)
            o.put("isArchived", c.isArchived)
            o.put("sortOrder", c.sortOrder)
            catsArr.put(o)
        }
        root.put("categories", catsArr)

        val tmplArr = JSONArray()
        templates.forEach { t ->
            val o = JSONObject()
            o.put("id", t.id)
            o.put("name", t.name)
            o.put("description", t.description)
            o.put("slotsJson", t.slotsJson)
            o.put("isDefault", t.isDefault)
            tmplArr.put(o)
        }
        root.put("dayTemplates", tmplArr)

        // Web App Parity: Grouped scheduleData
        val scheduleDataObj = JSONObject()
        val allWeekStarts = (slots.map { it.weekStart } + habits.map { it.weekStart } + todos.map { it.weekStart } + notes.map { it.weekStart }).distinct()
        for (wKey in allWeekStarts) {
            val weekObj = JSONObject()
            val wSlots = JSONObject()
            slots.filter { it.weekStart == wKey }.forEach { s ->
                val sObj = JSONObject()
                sObj.put("plannedTask", s.plannedTask)
                sObj.put("actualTask", s.actualTask)
                sObj.put("category", s.category)
                sObj.put("plannedDuration", s.plannedDuration)
                sObj.put("actualDuration", s.actualDuration)
                sObj.put("status", s.status)
                sObj.put("notes", s.notes ?: "")
                if (s.isProductive != null) sObj.put("isProductive", s.isProductive)
                wSlots.put(s.slotKey, sObj)
            }
            weekObj.put("slots", wSlots)

            val wHabits = JSONArray()
            habits.filter { it.weekStart == wKey }.forEach { h ->
                val hObj = JSONObject()
                hObj.put("id", h.id)
                hObj.put("habitName", h.habitName)
                hObj.put("category", h.category)
                hObj.put("pointsImpact", h.pointsImpact)
                hObj.put("notes", h.notes ?: "")
                hObj.put("loggedAt", h.loggedAt)
                wHabits.put(hObj)
            }
            weekObj.put("habits", wHabits)

            val wTodos = JSONArray()
            todos.filter { it.weekStart == wKey }.forEach { t ->
                val tObj = JSONObject()
                tObj.put("id", t.id)
                tObj.put("title", t.title)
                tObj.put("isCompleted", t.isCompleted)
                tObj.put("priority", t.priority)
                tObj.put("category", t.category)
                tObj.put("scheduledSlotKey", t.scheduledSlotKey ?: "")
                wTodos.put(tObj)
            }
            weekObj.put("todos", wTodos)

            val wNote = notes.firstOrNull { it.weekStart == wKey }?.notes ?: ""
            weekObj.put("notes", wNote)

            scheduleDataObj.put(wKey, weekObj)
        }
        root.put("scheduleData", scheduleDataObj)

        root.toString(2)
    }

    override suspend fun inspectBackupJson(jsonString: String): BackupInspectionResult = withContext(Dispatchers.Default) {
        try {
            val root = JSONObject(jsonString)
            val parsed = parsePayload(root)
            val total = parsed.slots.size + parsed.habits.size + parsed.todos.size + parsed.notes.size + parsed.categories.size + parsed.templates.size
            if (total == 0) {
                BackupInspectionResult(
                    isValid = false,
                    errorMessage = "No valid DayFlow schedule, habit, or todo items found in JSON."
                )
            } else {
                BackupInspectionResult(
                    isValid = true,
                    exportDate = root.optString("exportDate", "Unknown date"),
                    slotCount = parsed.slots.size,
                    habitCount = parsed.habits.size,
                    todoCount = parsed.todos.size,
                    notesCount = parsed.notes.size,
                    categoryCount = parsed.categories.size,
                    templateCount = parsed.templates.size
                )
            }
        } catch (e: Exception) {
            BackupInspectionResult(
                isValid = false,
                errorMessage = "Failed to parse JSON: ${e.message}"
            )
        }
    }

    override suspend fun restoreBackupJson(
        jsonString: String,
        wipeExisting: Boolean
    ): Result<BackupRestoreResult> = withContext(Dispatchers.IO) {
        try {
            val root = JSONObject(jsonString)
            val parsed = parsePayload(root)

            // Restore settings if present
            if (root.has("settings")) {
                val s = root.getJSONObject("settings")
                val tf = s.optString("timeFormat", "")
                if (tf == "12h" || tf == "24h") {
                    tokenManager.setTimeFormat(tf)
                }
                if (s.has("notificationsEnabled")) tokenManager.setNotificationsEnabled(s.getBoolean("notificationsEnabled"))
                if (s.has("startHour")) tokenManager.setNotifyStartHour(s.getInt("startHour"))
                if (s.has("endHour")) tokenManager.setNotifyEndHour(s.getInt("endHour"))
                if (s.has("muteWeekends")) tokenManager.setMuteWeekends(s.getBoolean("muteWeekends"))
                if (s.has("onlyProductive")) tokenManager.setOnlyProductive(s.getBoolean("onlyProductive"))
                if (s.has("biometricsEnabled")) tokenManager.setBiometricsEnabled(s.getBoolean("biometricsEnabled"))
            }

            val executeApply = suspend {
                if (wipeExisting) {
                    scheduleSlotDao.clearAllSlots()
                    habitLogDao.clearAllHabits()
                    todoDao.clearAllTodos()
                    weeklyNotesDao.clearAllNotes()
                    if (parsed.categories.isNotEmpty()) categoryDao.clearCategories()
                    if (parsed.templates.isNotEmpty()) dayTemplateDao.clearTemplates()
                }

                if (parsed.slots.isNotEmpty()) scheduleSlotDao.upsertSlots(parsed.slots)
                if (parsed.habits.isNotEmpty()) habitLogDao.upsertHabits(parsed.habits)
                if (parsed.todos.isNotEmpty()) todoDao.upsertTodos(parsed.todos)
                if (parsed.notes.isNotEmpty()) weeklyNotesDao.upsertNotesList(parsed.notes)
                if (parsed.categories.isNotEmpty()) categoryDao.upsertCategories(parsed.categories)
                if (parsed.templates.isNotEmpty()) dayTemplateDao.upsertTemplates(parsed.templates)
            }

            if (database != null) {
                database.withTransaction { executeApply() }
            } else {
                executeApply()
            }

            Result.success(
                BackupRestoreResult(
                    slotCount = parsed.slots.size,
                    habitCount = parsed.habits.size,
                    todoCount = parsed.todos.size,
                    notesCount = parsed.notes.size,
                    categoryCount = parsed.categories.size,
                    templateCount = parsed.templates.size
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private data class ParsedData(
        val slots: List<ScheduleSlotEntity>,
        val habits: List<HabitLogEntity>,
        val todos: List<TodoEntity>,
        val notes: List<WeeklyNotesEntity>,
        val categories: List<CategoryEntity>,
        val templates: List<DayTemplateEntity>
    )

    private fun parsePayload(root: JSONObject): ParsedData {
        val slotsList = mutableListOf<ScheduleSlotEntity>()
        val habitsList = mutableListOf<HabitLogEntity>()
        val todosList = mutableListOf<TodoEntity>()
        val notesList = mutableListOf<WeeklyNotesEntity>()
        val categoriesList = mutableListOf<CategoryEntity>()
        val templatesList = mutableListOf<DayTemplateEntity>()

        // 1. Direct arrays format
        if (root.has("slots") && root.get("slots") is JSONArray) {
            val arr = root.getJSONArray("slots")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val slotKey = o.optString("slotKey")
                val weekStart = o.optString("weekStart", if (slotKey.contains("_")) slotKey.split("_")[0] else "2026-10-12")
                if (slotKey.isNotBlank()) {
                    slotsList.add(
                        ScheduleSlotEntity(
                            slotKey = slotKey,
                            weekStart = weekStart,
                            plannedTask = o.optString("plannedTask", ""),
                            actualTask = o.optString("actualTask", ""),
                            category = o.optString("category", "Work"),
                            plannedDuration = o.optInt("plannedDuration", 30),
                            actualDuration = o.optInt("actualDuration", 0),
                            status = o.optString("status", "Pending"),
                            notes = if (o.has("notes")) o.optString("notes") else null,
                            isProductive = if (o.has("isProductive")) o.optBoolean("isProductive") else null
                        )
                    )
                }
            }
        }

        if (root.has("habits") && root.get("habits") is JSONArray) {
            val arr = root.getJSONArray("habits")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("habitName")
                if (name.isNotBlank()) {
                    habitsList.add(
                        HabitLogEntity(
                            id = o.optString("id", UUID.randomUUID().toString()),
                            weekStart = o.optString("weekStart", "2026-10-12"),
                            habitName = name,
                            category = o.optString("category", "Health"),
                            pointsImpact = o.optInt("pointsImpact", 0),
                            notes = if (o.has("notes")) o.optString("notes") else null,
                            loggedAt = o.optString("loggedAt", Instant.now().toString())
                        )
                    )
                }
            }
        }

        if (root.has("todos") && root.get("todos") is JSONArray) {
            val arr = root.getJSONArray("todos")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val title = o.optString("title")
                if (title.isNotBlank()) {
                    todosList.add(
                        TodoEntity(
                            id = o.optString("id", UUID.randomUUID().toString()),
                            weekStart = o.optString("weekStart", "2026-10-12"),
                            title = title,
                            isCompleted = o.optBoolean("isCompleted", false),
                            priority = o.optString("priority", "Medium"),
                            category = o.optString("category", "General"),
                            scheduledSlotKey = if (o.has("scheduledSlotKey")) o.optString("scheduledSlotKey") else null.takeIf { !it.isNullOrBlank() }
                        )
                    )
                }
            }
        }

        if (root.has("weeklyNotes") && root.get("weeklyNotes") is JSONArray) {
            val arr = root.getJSONArray("weeklyNotes")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val wStart = o.optString("weekStart")
                val text = o.optString("notes", "")
                if (wStart.isNotBlank()) {
                    notesList.add(WeeklyNotesEntity(weekStart = wStart, notes = text))
                }
            }
        }

        if (root.has("categories") && root.get("categories") is JSONArray) {
            val arr = root.getJSONArray("categories")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("name")
                if (name.isNotBlank()) {
                    categoriesList.add(
                        CategoryEntity(
                            id = o.optString("id", UUID.randomUUID().toString()),
                            name = name,
                            icon = o.optString("icon", "📋"),
                            color = o.optString("color", "#64748b"),
                            isProductive = o.optBoolean("isProductive", false),
                            isSystem = o.optBoolean("isSystem", false),
                            isArchived = o.optBoolean("isArchived", false),
                            sortOrder = o.optInt("sortOrder", i)
                        )
                    )
                }
            }
        }

        if (root.has("dayTemplates") && root.get("dayTemplates") is JSONArray) {
            val arr = root.getJSONArray("dayTemplates")
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("name")
                if (name.isNotBlank()) {
                    templatesList.add(
                        DayTemplateEntity(
                            id = o.optString("id", UUID.randomUUID().toString()),
                            name = name,
                            description = o.optString("description", ""),
                            slotsJson = o.optString("slotsJson", "{}"),
                            isDefault = o.optBoolean("isDefault", false)
                        )
                    )
                }
            }
        }

        // 2. DayFlow Web App scheduleData format
        val scheduleDataObj = root.optJSONObject("scheduleData")
        if (scheduleDataObj != null && slotsList.isEmpty()) {
            val keys = scheduleDataObj.keys()
            while (keys.hasNext()) {
                val wKey = keys.next()
                val wObj = scheduleDataObj.optJSONObject(wKey) ?: continue

                // Slots map
                val wSlots = wObj.optJSONObject("slots")
                if (wSlots != null) {
                    val slotKeys = wSlots.keys()
                    while (slotKeys.hasNext()) {
                        val sKey = slotKeys.next()
                        val sObj = wSlots.optJSONObject(sKey) ?: continue
                        slotsList.add(
                            ScheduleSlotEntity(
                                slotKey = sKey,
                                weekStart = wKey,
                                plannedTask = sObj.optString("plannedTask", ""),
                                actualTask = sObj.optString("actualTask", ""),
                                category = sObj.optString("category", "Work"),
                                plannedDuration = sObj.optInt("plannedDuration", 30),
                                actualDuration = sObj.optInt("actualDuration", 0),
                                status = sObj.optString("status", "Pending"),
                                notes = if (sObj.has("notes")) sObj.optString("notes") else null,
                                isProductive = if (sObj.has("isProductive")) sObj.optBoolean("isProductive") else null
                            )
                        )
                    }
                }

                // Habits list
                val wHabits = wObj.optJSONArray("habits")
                if (wHabits != null) {
                    for (hi in 0 until wHabits.length()) {
                        val hObj = wHabits.optJSONObject(hi) ?: continue
                        val hName = hObj.optString("habitName")
                        if (hName.isNotBlank()) {
                            habitsList.add(
                                HabitLogEntity(
                                    id = hObj.optString("id", UUID.randomUUID().toString()),
                                    weekStart = wKey,
                                    habitName = hName,
                                    category = hObj.optString("category", "Health"),
                                    pointsImpact = hObj.optInt("pointsImpact", 0),
                                    notes = if (hObj.has("notes")) hObj.optString("notes") else null,
                                    loggedAt = hObj.optString("loggedAt", Instant.now().toString())
                                )
                            )
                        }
                    }
                }

                // Todos list
                val wTodos = wObj.optJSONArray("todos")
                if (wTodos != null) {
                    for (ti in 0 until wTodos.length()) {
                        val tObj = wTodos.optJSONObject(ti) ?: continue
                        val tTitle = tObj.optString("title")
                        if (tTitle.isNotBlank()) {
                            todosList.add(
                                TodoEntity(
                                    id = tObj.optString("id", UUID.randomUUID().toString()),
                                    weekStart = wKey,
                                    title = tTitle,
                                    isCompleted = tObj.optBoolean("isCompleted", false),
                                    priority = tObj.optString("priority", "Medium"),
                                    category = tObj.optString("category", "General"),
                                    scheduledSlotKey = if (tObj.has("scheduledSlotKey")) tObj.optString("scheduledSlotKey") else null.takeIf { !it.isNullOrBlank() }
                                )
                            )
                        }
                    }
                }

                // Notes string
                val wNoteStr = wObj.optString("notes", "")
                if (wNoteStr.isNotBlank()) {
                    notesList.add(WeeklyNotesEntity(weekStart = wKey, notes = wNoteStr))
                }
            }
        }

        // 3. Single Day / Week export format from Web app
        val exportType = root.optString("exportType")
        if (exportType == "Day" && slotsList.isEmpty()) {
            val wKey = root.optString("weekKey", "2026-10-12")
            val daySlots = root.optJSONObject("slots")
            if (daySlots != null) {
                val sKeys = daySlots.keys()
                while (sKeys.hasNext()) {
                    val sKey = sKeys.next()
                    val sObj = daySlots.optJSONObject(sKey) ?: continue
                    slotsList.add(
                        ScheduleSlotEntity(
                            slotKey = sKey,
                            weekStart = wKey,
                            plannedTask = sObj.optString("plannedTask", ""),
                            actualTask = sObj.optString("actualTask", ""),
                            category = sObj.optString("category", "Work"),
                            plannedDuration = sObj.optInt("plannedDuration", 30),
                            actualDuration = sObj.optInt("actualDuration", 0),
                            status = sObj.optString("status", "Pending")
                        )
                    )
                }
            }
        }

        return ParsedData(
            slots = slotsList,
            habits = habitsList,
            todos = todosList,
            notes = notesList,
            categories = categoriesList,
            templates = templatesList
        )
    }
}
