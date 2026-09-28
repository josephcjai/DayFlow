package com.dayflow.app.domain.usecase

import com.dayflow.app.data.repository.TodoRepository
import javax.inject.Inject

class ToggleTodoUseCase @Inject constructor(
    private val todoRepository: TodoRepository
) {
    suspend operator fun invoke(id: String, isCompleted: Boolean): Result<Unit> {
        return todoRepository.toggleTodo(id, isCompleted)
    }
}
