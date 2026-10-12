package com.dayflow.app.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.glance.appwidget.updateAll
import com.dayflow.app.R
import com.dayflow.app.data.local.ScheduleSlotDao
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.domain.model.Category
import com.dayflow.app.presentation.MainActivity
import com.dayflow.app.presentation.widget.DayFlowWidget
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@AndroidEntryPoint
class SlotAlertReceiver : BroadcastReceiver() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var slotDao: ScheduleSlotDao

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Received broadcast action: ${intent.action}")

        // 1. Reschedule next reminder cycle
        SlotNotificationScheduler.scheduleNextReminder(context)

        // 2. Always trigger widget refresh on slot boundary
        CoroutineScope(Dispatchers.IO).launch {
            try {
                DayFlowWidget().updateAll(context)
            } catch (e: Exception) {
                Log.e(TAG, "Error updating Glance widget", e)
            }
        }

        // 3. User login validation
        if (tokenManager.getToken() == null && !tokenManager.isDemoMode()) {
            Log.d(TAG, "No logged in user; skipping notification")
            return
        }

        if (!tokenManager.isNotificationsEnabled()) {
            Log.d(TAG, "Notifications globally disabled by user")
            return
        }

        val now = LocalDateTime.now()

        // 4. Weekend Mute Check
        val dayOfWeek = now.dayOfWeek
        if (tokenManager.isMuteWeekends() && (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY)) {
            Log.d(TAG, "Notification suppressed: Weekend Mute active ($dayOfWeek)")
            return
        }

        // 5. Active Hours Window (Quiet Hours) Check
        if (tokenManager.isActiveWindowEnabled()) {
            val currentHour = now.hour
            val startHour = tokenManager.getNotifyStartHour()
            val endHour = tokenManager.getNotifyEndHour()

            val inActiveWindow = if (startHour <= endHour) {
                currentHour in startHour until endHour
            } else {
                currentHour >= startHour || currentHour < endHour
            }

            if (!inActiveWindow) {
                Log.d(TAG, "Notification suppressed: Quiet Hours active (currentHour=$currentHour, window=$startHour-$endHour)")
                return
            }
        }

        // 6. Productive-Only Filter Check
        CoroutineScope(Dispatchers.IO).launch {
            if (tokenManager.isOnlyProductive()) {
                // Find upcoming slot key (target :00 or :30 boundary in ~5 mins)
                val minute = now.minute
                val targetTime = when {
                    minute < 30 -> now.withMinute(30).withSecond(0).withNano(0)
                    else -> now.plusHours(1).withMinute(0).withSecond(0).withNano(0)
                }
                val slotKey = targetTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH:mm"))
                val slot = slotDao.getSlotByKey(slotKey)

                val isProductive = slot?.isProductive ?: slot?.let {
                    Category.fromString(it.category).defaultProductive
                } ?: true

                if (!isProductive) {
                    Log.d(TAG, "Notification suppressed: Productive-only filter active for slot $slotKey (productive=$isProductive)")
                    return@launch
                }
            }

            createNotificationChannel(context)
            showSlotTransitionNotification(context)
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "DayFlow Slot Reminders"
            val descriptionText = "Reminders 5 minutes before your focus slots end"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showSlotTransitionNotification(context: Context) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("DayFlow • Slot Ending Soon")
            .setContentText("Your current 30-min block finishes in 5 minutes. Tap to record your progress!")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val TAG = "SlotAlertReceiver"
        const val CHANNEL_ID = "dayflow_slot_alerts"
        const val NOTIFICATION_ID = 8801
    }
}
