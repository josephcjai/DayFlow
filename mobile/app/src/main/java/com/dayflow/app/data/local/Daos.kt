package com.dayflow.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface ScheduleSlotDao {
    @Query("SELECT * FROM schedule_slots WHERE weekStart = :weekStart ORDER BY slotKey ASC")
    fun getSlotsForWeek(weekStart: String): Flow<List<ScheduleSlotEntity>>

    @Query("SELECT * FROM schedule_slots WHERE slotKey = :slotKey LIMIT 1")
    suspend fun getSlotByKey(slotKey: String): ScheduleSlotEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSlot(slot: ScheduleSlotEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSlots(slots: List<ScheduleSlotEntity>)

    @Query("DELETE FROM schedule_slots WHERE slotKey = :slotKey")
    suspend fun deleteSlot(slotKey: String)

    @Query("DELETE FROM schedule_slots WHERE weekStart = :weekStart")
    suspend fun clearWeek(weekStart: String)
}

@Dao
interface HabitLogDao {
    @Query("SELECT * FROM habit_logs WHERE weekStart = :weekStart ORDER BY loggedAt DESC")
    fun getHabitsForWeek(weekStart: String): Flow<List<HabitLogEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertHabit(habit: HabitLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertHabits(habits: List<HabitLogEntity>)

    @Query("DELETE FROM habit_logs WHERE id = :id")
    suspend fun deleteHabit(id: String)

    @Query("DELETE FROM habit_logs WHERE weekStart = :weekStart")
    suspend fun clearHabitsForWeek(weekStart: String)
}

@Dao
interface TodoDao {
    @Query("SELECT * FROM todo_items WHERE weekStart = :weekStart ORDER BY isCompleted ASC")
    fun getTodosForWeek(weekStart: String): Flow<List<TodoEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTodo(todo: TodoEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTodos(todos: List<TodoEntity>)

    @Query("UPDATE todo_items SET isCompleted = :isCompleted, isSyncPending = :isSyncPending WHERE id = :id")
    suspend fun updateCompletion(id: String, isCompleted: Boolean, isSyncPending: Boolean = true)

    @Query("DELETE FROM todo_items WHERE id = :id")
    suspend fun deleteTodo(id: String)

    @Query("DELETE FROM todo_items WHERE weekStart = :weekStart")
    suspend fun clearTodosForWeek(weekStart: String)
}

@Dao
interface WeeklyNotesDao {
    @Query("SELECT * FROM weekly_notes WHERE weekStart = :weekStart LIMIT 1")
    fun getNotesForWeek(weekStart: String): Flow<WeeklyNotesEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertNotes(notes: WeeklyNotesEntity)
}

@Dao
interface MutationQueueDao {
    @Query("SELECT * FROM mutation_queue ORDER BY createdAt ASC")
    suspend fun getAllPendingMutations(): List<MutationQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(mutation: MutationQueueEntity): Long

    @Query("DELETE FROM mutation_queue WHERE id = :id")
    suspend fun deleteMutation(id: Long)

    @Query("DELETE FROM mutation_queue")
    suspend fun clearQueue()
}

@Dao
interface CategoryDao {
    @Query("SELECT * FROM user_categories WHERE isArchived = 0 ORDER BY sortOrder ASC")
    fun getActiveCategories(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM user_categories WHERE isArchived = 0 ORDER BY sortOrder ASC")
    suspend fun getActiveCategoriesSync(): List<CategoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategories(categories: List<CategoryEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategory(category: CategoryEntity)

    @Query("UPDATE user_categories SET isArchived = 1, isSyncPending = :isSyncPending WHERE id = :id")
    suspend fun archiveCategory(id: String, isSyncPending: Boolean = false)

    @Query("DELETE FROM user_categories WHERE id = :id")
    suspend fun deleteCategory(id: String)

    @Query("DELETE FROM user_categories")
    suspend fun clearCategories()
}

@Dao
interface DayTemplateDao {
    @Query("SELECT * FROM user_day_templates")
    fun getAllTemplates(): Flow<List<DayTemplateEntity>>

    @Query("SELECT * FROM user_day_templates")
    suspend fun getAllTemplatesSync(): List<DayTemplateEntity>

    @Query("SELECT * FROM user_day_templates WHERE id = :id")
    suspend fun getTemplateById(id: String): DayTemplateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTemplate(template: DayTemplateEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTemplates(templates: List<DayTemplateEntity>)

    @Query("DELETE FROM user_day_templates WHERE id = :id")
    suspend fun deleteTemplate(id: String)

    @Query("DELETE FROM user_day_templates")
    suspend fun clearTemplates()
}