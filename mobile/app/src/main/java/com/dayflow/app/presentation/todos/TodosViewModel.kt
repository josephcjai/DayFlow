package com.dayflow.app.presentation.todos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dayflow.app.data.local.TodoEntity
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.domain.usecase.ToggleTodoUseCase
import com.dayflow.app.domain.util.DateTimeUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class TodosViewModel @Inject constructor(
    private val todoRepository: TodoRepository,
    private val toggleTodoUseCase: ToggleTodoUseCase
) : ViewModel() {

    private val _currentWeekStart = MutableStateFlow(DateTimeUtils.getWeekKey(LocalDate.now()))
    val currentWeekStart: StateFlow<String> = _currentWeekStart.asStateFlow()

    val todos: StateFlow<List<TodoEntity>> = _currentWeekStart.flatMapLatest { weekStart ->
        todoRepository.getTodos(weekStart)
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

    fun createTodo(title: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            todoRepository.createTodo(_currentWeekStart.value, title.trim())
        }
    }

    fun toggleTodo(id: String, isCompleted: Boolean) {
        viewModelScope.launch {
            toggleTodoUseCase(id, isCompleted)
        }
    }

    fun deleteTodo(id: String) {
        viewModelScope.launch {
            todoRepository.deleteTodo(id)
        }
    }

    fun saveNotes(notesText: String) {
        viewModelScope.launch {
            todoRepository.saveNotes(_currentWeekStart.value, notesText.trim())
        }
    }
}
