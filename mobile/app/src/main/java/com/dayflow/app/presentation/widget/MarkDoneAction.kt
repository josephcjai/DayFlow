package com.dayflow.app.presentation.widget

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.updateAll
import com.dayflow.app.data.local.ScheduleSlotEntity
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MarkDoneAction : ActionCallback {

    companion object {
        val slotKeyParam = ActionParameters.Key<String>("slotKey")
    }

    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val slotKey = parameters[slotKeyParam] ?: return

        val entryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext,
            DayFlowWidgetEntryPoint::class.java
        )
        val scheduleRepo = entryPoint.scheduleRepository()
        val slotDao = entryPoint.slotDao()
        val syncManager = entryPoint.syncManager()

        withContext(Dispatchers.IO) {
            val existing = slotDao.getSlotByKey(slotKey)
            if (existing != null) {
                val updated = existing.copy(
                    status = "Done",
                    actualDuration = if (existing.actualDuration == 0) existing.plannedDuration else existing.actualDuration
                )
                scheduleRepo.saveSlot(updated)
                syncManager.syncNow()
            }
        }

        // Re-render all widgets immediately
        DayFlowWidget().updateAll(context)
    }
}
