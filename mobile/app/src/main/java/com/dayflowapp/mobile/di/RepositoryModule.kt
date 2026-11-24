package com.dayflowapp.mobile.di

import com.dayflowapp.mobile.data.repository.AuthRepository
import com.dayflowapp.mobile.data.repository.AuthRepositoryImpl
import com.dayflowapp.mobile.data.repository.HabitRepository
import com.dayflowapp.mobile.data.repository.HabitRepositoryImpl
import com.dayflowapp.mobile.data.repository.ScheduleRepository
import com.dayflowapp.mobile.data.repository.ScheduleRepositoryImpl
import com.dayflowapp.mobile.data.repository.TodoRepository
import com.dayflowapp.mobile.data.repository.TodoRepositoryImpl
import com.dayflowapp.mobile.data.repository.CategoryRepository
import com.dayflowapp.mobile.data.repository.CategoryRepositoryImpl
import com.dayflowapp.mobile.data.repository.TemplateRepository
import com.dayflowapp.mobile.data.repository.TemplateRepositoryImpl
import com.dayflowapp.mobile.data.repository.BackupRepository
import com.dayflowapp.mobile.data.repository.BackupRepositoryImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindScheduleRepository(impl: ScheduleRepositoryImpl): ScheduleRepository

    @Binds
    @Singleton
    abstract fun bindHabitRepository(impl: HabitRepositoryImpl): HabitRepository

    @Binds
    @Singleton
    abstract fun bindTodoRepository(impl: TodoRepositoryImpl): TodoRepository

    @Binds
    @Singleton
    abstract fun bindCategoryRepository(impl: CategoryRepositoryImpl): CategoryRepository

    @Binds
    @Singleton
    abstract fun bindTemplateRepository(impl: TemplateRepositoryImpl): TemplateRepository

    @Binds
    @Singleton
    abstract fun bindBackupRepository(impl: BackupRepositoryImpl): BackupRepository

}
