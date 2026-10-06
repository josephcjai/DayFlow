package com.dayflow.app.presentation.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
import androidx.glance.ButtonDefaults
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import android.content.Intent
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.local.ScheduleSlotEntity
import com.dayflow.app.data.repository.ScheduleRepository
import com.dayflow.app.data.sync.SyncManager
import com.dayflow.app.domain.util.DateTimeUtils
import com.dayflow.app.presentation.MainActivity
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDateTime

@EntryPoint
@InstallIn(SingletonComponent::class)
interface DayFlowWidgetEntryPoint {
    fun slotDao(): ScheduleSlotDao
    fun syncManager(): SyncManager
    fun scheduleRepository(): ScheduleRepository
}

class DayFlowWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext,
            DayFlowWidgetEntryPoint::class.java
        )
        val slotDao = entryPoint.slotDao()

        val now = LocalDateTime.now()
        val currentSlotKey = DateTimeUtils.getCurrentSlotKey(now)
        val (_, time) = DateTimeUtils.parseSlotKey(currentSlotKey)
        val endTime = time.plusMinutes(30)
        val timeRangeLabel = String.format("%02d:%02d - %02d:%02d", time.hour, time.minute, endTime.hour, endTime.minute)

        val slotEntity = withContext(Dispatchers.IO) {
            slotDao.getSlotByKey(currentSlotKey)
        }

        provideContent {
            val bgDark = ColorProvider(Color(0xFF0F172A))
            val surfaceDark = ColorProvider(Color(0xFF1E293B))
            val primaryCyan = ColorProvider(Color(0xFF38BDF8))
            val textWhite = ColorProvider(Color(0xFFF8FAFC))
            val textMuted = ColorProvider(Color(0xFF94A3B8))
            val doneGreen = ColorProvider(Color(0xFF10B981))

            Box(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .background(bgDark)
                    .cornerRadius(16.dp)
                    .padding(12.dp)
                    .clickable(actionStartActivity(Intent(context, MainActivity::class.java)))
            ) {
                Column(
                    modifier = GlanceModifier.fillMaxSize()
                ) {
                    // 1. Header Row: Logo & Time Range
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "DayFlow",
                            style = TextStyle(
                                color = primaryCyan,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Spacer(modifier = GlanceModifier.defaultWeight())
                        Text(
                            text = timeRangeLabel,
                            style = TextStyle(
                                color = textMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(8.dp))

                    // 2. Middle Task Card
                    Box(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .defaultWeight()
                            .background(surfaceDark)
                            .cornerRadius(10.dp)
                            .padding(8.dp)
                    ) {
                        Column(
                            modifier = GlanceModifier.fillMaxSize()
                        ) {
                            if (slotEntity != null && slotEntity.plannedTask.isNotBlank()) {
                                Text(
                                    text = slotEntity.plannedTask,
                                    style = TextStyle(
                                        color = textWhite,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    ),
                                    maxLines = 1
                                )
                                Spacer(modifier = GlanceModifier.height(2.dp))
                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "${slotEntity.category} • 30m",
                                        style = TextStyle(
                                            color = primaryCyan,
                                            fontSize = 11.sp
                                        )
                                    )
                                    Spacer(modifier = GlanceModifier.width(6.dp))
                                    Text(
                                        text = "• ${slotEntity.status}",
                                        style = TextStyle(
                                            color = if (slotEntity.status == "Done") doneGreen else textMuted,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                    )
                                }
                            } else {
                                Text(
                                    text = "Available 30-min block",
                                    style = TextStyle(
                                        color = textMuted,
                                        fontSize = 13.sp
                                    )
                                )
                                Spacer(modifier = GlanceModifier.height(2.dp))
                                Text(
                                    text = "Tap to schedule focus task",
                                    style = TextStyle(
                                        color = primaryCyan,
                                        fontSize = 11.sp
                                    )
                                )
                            }
                        }
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // 3. Bottom Action Row
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (slotEntity != null && slotEntity.plannedTask.isNotBlank() && slotEntity.status != "Done") {
                            Button(
                                text = "✓ Mark Done",
                                onClick = actionRunCallback<MarkDoneAction>(
                                    actionParametersOf(MarkDoneAction.slotKeyParam to currentSlotKey)
                                ),
                                colors = ButtonDefaults.buttonColors(
                                    backgroundColor = doneGreen,
                                    contentColor = ColorProvider(Color.White)
                                ),
                                modifier = GlanceModifier.fillMaxWidth().height(32.dp)
                            )
                        } else if (slotEntity != null && slotEntity.status == "Done") {
                            Text(
                                text = "✓ Completed on Schedule",
                                style = TextStyle(
                                    color = doneGreen,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        } else {
                            Text(
                                text = "DayFlow Focus Mode",
                                style = TextStyle(
                                    color = textMuted,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}
