package com.dayflow.app.di

import android.content.Context
import androidx.room.Room
import com.dayflow.app.data.local.DayFlowDatabase
import com.dayflow.app.data.local.HabitLogDao
import com.dayflow.app.data.local.MutationQueueDao
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.TodoDao
import com.dayflow.app.data.local.WeeklyNotesDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DayFlowDatabase {
        return Room.databaseBuilder(
            context,
            DayFlowDatabase::class.java,
            DayFlowDatabase.DATABASE_NAME
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideScheduleSlotDao(database: DayFlowDatabase): ScheduleSlotDao {
        return database.scheduleSlotDao()
    }

    @Provides
    fun provideHabitLogDao(database: DayFlowDatabase): HabitLogDao {
        return database.habitLogDao()
    }

    @Provides
    fun provideTodoDao(database: DayFlowDatabase): TodoDao {
        return database.todoDao()
    }

    @Provides
    fun provideWeeklyNotesDao(database: DayFlowDatabase): WeeklyNotesDao {
        return database.weeklyNotesDao()
    }

    @Provides
    fun provideMutationQueueDao(database: DayFlowDatabase): MutationQueueDao {
        return database.mutationQueueDao()
    }
}
