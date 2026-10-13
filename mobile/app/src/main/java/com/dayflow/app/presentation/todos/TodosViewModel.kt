package com.dayflow.app.presentation.todos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.domain.model.CategoryItem
import com.dayflow.app.domain.model.TodoFilter
import com.dayflow.app.domain.usecase.ScheduleTodoResult
import com.dayflow.app.domain.usecase.ScheduleTodoToGridUseCase
import com.dayflow.app.domain.usecase.ToggleTodoUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class TodosViewModel @Inject constructor(
    private val todoRepository: TodoRepository,
    private val categoryRepository: CategoryRepository,
    private val toggleTodoUseCase: ToggleTodoUseCase,
    private val scheduleTodoToGridUseCase: ScheduleTodoToGridUseCase
) : ViewModel() {

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

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

    init {
        viewModelScope.launch {
            categoryRepository.refreshCategories()
        }
    }

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
