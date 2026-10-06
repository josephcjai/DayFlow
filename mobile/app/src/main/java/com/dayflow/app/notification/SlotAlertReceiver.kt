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
import com.dayflow.app.data.remote.TokenManager
import com.dayflow.app.presentation.MainActivity
import com.dayflow.app.presentation.widget.DayFlowWidget
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SlotAlertReceiver : BroadcastReceiver() {

    @Inject
    lateinit var tokenManager: TokenManager

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Received broadcast action: ${intent.action}")

        // Reschedule next reminder cycle
        SlotNotificationScheduler.scheduleNextReminder(context)

        // Always trigger widget refresh on slot boundary
        CoroutineScope(Dispatchers.IO).launch {
            try {
                DayFlowWidget().updateAll(context)
            } catch (e: Exception) {
                Log.e(TAG, "Error updating Glance widget", e)
            }
        }

        // Only show notification if user is logged in
        if (tokenManager.getToken() == null) {
            Log.d(TAG, "No logged in user; skipping notification")
            return
        }

        createNotificationChannel(context)
        showSlotTransitionNotification(context)
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
