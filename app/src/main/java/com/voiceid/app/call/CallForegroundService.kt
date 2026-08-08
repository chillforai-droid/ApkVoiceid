package com.voiceid.app.call

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.voiceid.app.MainActivity
import com.voiceid.app.VoiceIdApplication

/**
 * Keeps the WebRTC audio session (and its Realtime signaling subscription) alive when the
 * user backgrounds the app mid-call — otherwise Android can suspend the process and drop
 * the call, which the web app never has to worry about. Started/stopped from CallViewModel
 * around the OUTGOING_RINGING/CONNECTING/ACTIVE lifetime of a call.
 */
class CallForegroundService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val callerLabel = intent?.getStringExtra(EXTRA_LABEL) ?: "VoiceID call"
        startForeground(NOTIFICATION_ID, buildNotification(callerLabel))
        return START_STICKY
    }

    private fun buildNotification(label: String): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP },
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_IMMUTABLE else 0
        )
        return NotificationCompat.Builder(this, VoiceIdApplication.CHANNEL_CALLS)
            .setContentTitle("VoiceID call in progress")
            .setContentText(label)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val NOTIFICATION_ID = 5501
        const val EXTRA_LABEL = "label"
    }
}
