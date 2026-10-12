package com.dayflow.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [
        ScheduleSlotEntity::class,
        HabitLogEntity::class,
        TodoEntity::class,
        WeeklyNotesEntity::class,
        MutationQueueEntity::class,
        CategoryEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class DayFlowDatabase : RoomDatabase() {
    abstract fun scheduleSlotDao(): ScheduleSlotDao
    abstract fun habitLogDao(): HabitLogDao
    abstract fun todoDao(): TodoDao
    abstract fun weeklyNotesDao(): WeeklyNotesDao
    abstract fun mutationQueueDao(): MutationQueueDao
    abstract fun categoryDao(): CategoryDao

    companion object {
        const val DATABASE_NAME = "dayflow_database"
    }
}
