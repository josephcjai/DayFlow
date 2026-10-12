package com.dayflow.app

import android.app.Application
import com.dayflow.app.data.repository.CategoryRepository
import com.dayflow.app.data.repository.TemplateRepository
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class DayFlowApp : Application() {

    @Inject
    lateinit var categoryRepository: CategoryRepository

    @Inject
    lateinit var templateRepository: TemplateRepository

    override fun onCreate() {
        super.onCreate()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                categoryRepository.seedDefaultCategories()
                templateRepository.seedDefaultTemplates()
            } catch (e: Exception) {
                // Background seed safety
            }
        }
    }
}
