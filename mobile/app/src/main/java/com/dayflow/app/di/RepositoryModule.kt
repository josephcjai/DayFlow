package com.dayflow.app.di

import com.dayflow.app.data.repository.AuthRepository
import com.dayflow.app.data.repository.AuthRepositoryImpl
import com.dayflow.app.data.repository.HabitRepository
import com.dayflow.app.data.repository.HabitRepositoryImpl
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.data.repository.ScheduleRepositoryImpl
import com.dayflow.app.data.repository.TodoRepository
import com.dayflow.app.data.repository.TodoRepositoryImpl
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.data.repository.CategoryRepositoryImpl
import com.dayflow.app.data.repository.TemplateRepository
import com.dayflow.app.data.repository.TemplateRepositoryImpl
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
}
