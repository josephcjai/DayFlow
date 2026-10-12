package com.dayflow.app

import android.app.Application
import com.dayflow.app.data.repository.CategoryRepository
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class DayFlowApp : Application() {

    @Inject
    lateinit var categoryRepository: CategoryRepository

    override fun onCreate() {
        super.onCreate()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                categoryRepository.seedDefaultCategories()
            } catch (e: Exception) {
                // Background seed safety
            }
        }
    }
}
