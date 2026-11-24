package com.dayflowapp.mobile.domain.usecase

import com.dayflowapp.mobile.data.repository.TodoRepository
import javax.inject.Inject

class ToggleTodoUseCase @Inject constructor(
    private val todoRepository: TodoRepository
) {
    suspend operator fun invoke(id: String, isCompleted: Boolean): Result<Unit> {
        return todoRepository.toggleTodo(id, isCompleted)
    }
}
