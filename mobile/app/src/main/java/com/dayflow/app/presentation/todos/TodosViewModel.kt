package com.dayflow.app.presentation.todos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.DefaultNoteSheets
import com.dayflow.app.domain.model.NoteSheet
import com.dayflow.app.domain.model.NotesSaveStatus
import com.dayflow.app.domain.model.TodoFilter
import com.dayflow.app.domain.usecase.ScheduleTodoResult
import com.dayflow.app.domain.usecase.ScheduleTodoToGridUseCase
import com.dayflow.app.domain.usecase.ToggleTodoUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
@HiltViewModel
class TodosViewModel @Inject constructor(
    private val todoRepository: TodoRepository,
    private val categoryRepository: CategoryRepository,
    private val toggleTodoUseCase: ToggleTodoUseCase,
    private val scheduleTodoToGridUseCase: ScheduleTodoToGridUseCase,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val _selectedDate = MutableStateFlow(LocalDate.now())
    val selectedDate: StateFlow<LocalDate> = _selectedDate.asStateFlow()

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

    val weekDays: StateFlow<List<LocalDate>> = _selectedDate.map { date ->
        val monday = DateTimeUtils.getMondayOfWeek(date)
        DateTimeUtils.generateWeekDays(monday)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DateTimeUtils.generateWeekDays(DateTimeUtils.getMondayOfWeek(LocalDate.now()))
    )

    private val _activeFilter = MutableStateFlow(TodoFilter.ALL)
    val activeFilter: StateFlow<TodoFilter> = _activeFilter.asStateFlow()

    val categories: StateFlow<List<CategoryItem>> = categoryRepository.getCategories()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val allTodos: StateFlow<List<TodoEntity>> = _currentWeekStart.flatMapLatest { weekStart ->
        todoRepository.getTodos(weekStart)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val todos: StateFlow<List<TodoEntity>> = combine(allTodos, _activeFilter) { list, filter ->
        when (filter) {
            TodoFilter.ALL -> list
            TodoFilter.HIGH -> list.filter { it.priority.equals("High", ignoreCase = true) }
            TodoFilter.MEDIUM -> list.filter { it.priority.equals("Medium", ignoreCase = true) }
            TodoFilter.LOW -> list.filter { it.priority.equals("Low", ignoreCase = true) }
            TodoFilter.PENDING -> list.filter { !it.isCompleted }
            TodoFilter.DONE -> list.filter { it.isCompleted }
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val notes: StateFlow<String?> = _currentWeekStart.flatMapLatest { weekStart ->
        todoRepository.getNotes(weekStart)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = null
    )

    // ==========================================
    // Phase 14: Note Sheets & Markdown State
    // ==========================================

    private val _noteSheets = MutableStateFlow<List<NoteSheet>>(loadInitialNoteSheets())
    val noteSheets: StateFlow<List<NoteSheet>> = _noteSheets.asStateFlow()

    private val _activeSheetId = MutableStateFlow("journal")
    val activeSheetId: StateFlow<String> = _activeSheetId.asStateFlow()

    private val _activeContent = MutableStateFlow(resolveSheetContent(_noteSheets.value.firstOrNull(), LocalDate.now()))
    val activeContent: StateFlow<String> = _activeContent.asStateFlow()

    private val _notesSaveStatus = MutableStateFlow(NotesSaveStatus.SAVED)
    val notesSaveStatus: StateFlow<NotesSaveStatus> = _notesSaveStatus.asStateFlow()

    private var autoSaveJob: Job? = null

    init {
        viewModelScope.launch {
            categoryRepository.refreshCategories()
            todoRepository.refreshTodos(_currentWeekStart.value)
        }

        // When repository notes update, ensure Weekly Journal has content
        viewModelScope.launch {
            notes.collect { repoNotes ->
                if (!repoNotes.isNullOrBlank()) {
                    val currentSheets = _noteSheets.value.toMutableList()
                    val journalIdx = currentSheets.indexOfFirst { it.id == "journal" }
                    if (journalIdx >= 0) {
                        val currentJournal = currentSheets[journalIdx]
                        if (currentJournal.content.isBlank() || currentJournal.content == DefaultNoteSheets.JOURNAL.content) {
                            currentSheets[journalIdx] = currentJournal.copy(content = repoNotes)
                            _noteSheets.value = currentSheets
                            if (_activeSheetId.value == "journal") {
                                _activeContent.value = repoNotes
                            }
                        }
                    }
                }
            }
        }
    }

    private fun loadInitialNoteSheets(): List<NoteSheet> {
        return loadNoteSheetsForWeek(_currentWeekStart.value)
    }

    private fun loadNoteSheetsForWeek(weekStart: String): List<NoteSheet> {
        val savedJson = tokenManager.getNoteSheetsJson(weekStart)
        if (!savedJson.isNullOrBlank()) {
            try {
                val list = json.decodeFromString<List<NoteSheet>>(savedJson)
                if (list.isNotEmpty()) return list
            } catch (e: Exception) {
                // Fallback to default
            }
        }
        return DefaultNoteSheets.ALL
    }

    private fun resolveSheetContent(sheet: NoteSheet?, date: LocalDate): String {
        if (sheet == null) return ""
        return if (sheet.id == "daily_journal") {
            val dateKey = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
            val dayName = date.dayOfWeek.name.lowercase().replaceFirstChar { it.uppercase() }
            val formattedDate = date.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
            sheet.dailyContent[dateKey] ?: "# Daily Reflection — $dayName, $formattedDate\n\n### Wins Today\n- \n\n### Blockers & Learnings\n- "
        } else {
            sheet.content
        }
    }

    fun selectDate(date: LocalDate) {
        if (_notesSaveStatus.value == NotesSaveStatus.UNSAVED) {
            saveNotesImmediately(_selectedDate.value)
        }

        val oldWeek = _currentWeekStart.value
        val newWeekKey = DateTimeUtils.getWeekKey(date)
        _selectedDate.value = date

        if (newWeekKey != oldWeek) {
            _currentWeekStart.value = newWeekKey
            _noteSheets.value = loadNoteSheetsForWeek(newWeekKey)
            viewModelScope.launch {
                todoRepository.refreshTodos(newWeekKey)
            }
        }

        val targetSheet = _noteSheets.value.find { it.id == _activeSheetId.value } ?: _noteSheets.value.firstOrNull()
        _activeContent.value = resolveSheetContent(targetSheet, date)
        _notesSaveStatus.value = NotesSaveStatus.SAVED
    }

    fun previousWeek() {
        selectDate(_selectedDate.value.minusWeeks(1))
    }

    fun nextWeek() {
        selectDate(_selectedDate.value.plusWeeks(1))
    }

    fun selectToday() {
        selectDate(LocalDate.now())
    }

    fun selectSheet(sheetId: String, currentDate: LocalDate = _selectedDate.value) {
        // Auto-save before switching if unsaved
        if (_notesSaveStatus.value == NotesSaveStatus.UNSAVED) {
            saveNotesImmediately(currentDate)
        }

        _activeSheetId.value = sheetId
        val targetSheet = _noteSheets.value.find { it.id == sheetId } ?: _noteSheets.value.firstOrNull()
        _activeContent.value = resolveSheetContent(targetSheet, currentDate)
        _notesSaveStatus.value = NotesSaveStatus.SAVED
    }

    fun updateSheetContent(text: String, currentDate: LocalDate = _selectedDate.value) {
        _activeContent.value = text
        _notesSaveStatus.value = NotesSaveStatus.UNSAVED

        // Update local sheet in-memory
        val currentSheets = _noteSheets.value.toMutableList()
        val targetIdx = currentSheets.indexOfFirst { it.id == _activeSheetId.value }
        if (targetIdx >= 0) {
            val sheet = currentSheets[targetIdx]
            currentSheets[targetIdx] = if (sheet.id == "daily_journal") {
                val dateKey = currentDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
                val updatedDaily = sheet.dailyContent.toMutableMap().apply { put(dateKey, text) }
                sheet.copy(content = text, dailyContent = updatedDaily)
            } else {
                sheet.copy(content = text)
            }
            _noteSheets.value = currentSheets
        }

        // Trigger debounced auto-save (1.5 seconds)
        autoSaveJob?.cancel()
        autoSaveJob = viewModelScope.launch {
            delay(1500)
            saveNotesImmediately(currentDate)
        }
    }

    fun saveNotesImmediately(currentDate: LocalDate = _selectedDate.value) {
        autoSaveJob?.cancel()
        _notesSaveStatus.value = NotesSaveStatus.SAVING

        viewModelScope.launch {
            try {
                // 1. Persist noteSheets to TokenManager
                val encoded = json.encodeToString(_noteSheets.value)
                tokenManager.saveNoteSheetsJson(_currentWeekStart.value, encoded)

                // 2. Persist journal content to repository
                val journalSheet = _noteSheets.value.find { it.id == "journal" }
                val journalContent = journalSheet?.content ?: _activeContent.value
                todoRepository.saveNotes(_currentWeekStart.value, journalContent)

                _notesSaveStatus.value = NotesSaveStatus.SAVED
            } catch (e: Exception) {
                _notesSaveStatus.value = NotesSaveStatus.UNSAVED
            }
        }
    }

    fun addCustomSheet(title: String, icon: String, currentDate: LocalDate = _selectedDate.value) {
        if (title.isBlank()) return
        val newSheet = NoteSheet(
            id = "custom_${System.currentTimeMillis()}",
            title = title.trim(),
            icon = icon.ifBlank { "📝" },
            content = "# ${title.trim()}\n\nStart writing...",
            isDefault = false
        )
        val updated = _noteSheets.value + newSheet
        _noteSheets.value = updated
        selectSheet(newSheet.id, currentDate)

        // Save immediately
        val encoded = json.encodeToString(updated)
        tokenManager.saveNoteSheetsJson(_currentWeekStart.value, encoded)
    }

    fun deleteSheet(sheetId: String, currentDate: LocalDate = _selectedDate.value) {
        val updated = _noteSheets.value.filter { it.id != sheetId }
        _noteSheets.value = updated

        if (_activeSheetId.value == sheetId) {
            selectSheet(updated.firstOrNull()?.id ?: "journal", currentDate)
        }

        val encoded = json.encodeToString(updated)
        tokenManager.saveNoteSheetsJson(_currentWeekStart.value, encoded)
    }

    // ==========================================
    // Todos Actions
    // ==========================================

    fun setFilter(filter: TodoFilter) {
        _activeFilter.value = filter
    }

    fun createTodo(
        title: String,
        priority: String = "Medium",
        category: String = "General"
    ) {
        if (title.isBlank()) return
        viewModelScope.launch {
            todoRepository.createTodo(
                weekStart = _currentWeekStart.value,
                title = title.trim(),
                priority = priority,
                category = category
            )
        }
    }

    fun toggleTodo(id: String, isCompleted: Boolean) {
        viewModelScope.launch {
            toggleTodoUseCase(id, isCompleted)
        }
    }

    fun deleteTodo(todo: TodoEntity, clearScheduledSlot: Boolean = false) {
        viewModelScope.launch {
            if (clearScheduledSlot && !todo.scheduledSlotKey.isNullOrBlank()) {
                scheduleTodoToGridUseCase.unschedule(todo)
            }
            todoRepository.deleteTodo(todo.id)
        }
    }

    fun saveNotes(notesText: String) {
        viewModelScope.launch {
            todoRepository.saveNotes(_currentWeekStart.value, notesText.trim())
        }
    }

    suspend fun checkSlotConflict(date: LocalDate, timeStr: String) =
        scheduleTodoToGridUseCase.checkConflict(date, timeStr)

    suspend fun findNextFreeSlot(date: LocalDate, preferredTimeStr: String = "09:00") =
        scheduleTodoToGridUseCase.findNextFreeSlot(date, preferredTimeStr)

    fun scheduleTodoToGrid(
        todo: TodoEntity,
        date: LocalDate,
        timeStr: String,
        forceOverwrite: Boolean = false,
        onResult: (ScheduleTodoResult) -> Unit
    ) {
        viewModelScope.launch {
            val result = scheduleTodoToGridUseCase.execute(todo, date, timeStr, forceOverwrite)
            onResult(result)
        }
    }

    fun unscheduleTodo(todo: TodoEntity) {
        viewModelScope.launch {
            scheduleTodoToGridUseCase.unschedule(todo)
        }
    }
}
