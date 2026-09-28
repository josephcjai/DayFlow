package com.dayflow.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class DayFlowApp : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
