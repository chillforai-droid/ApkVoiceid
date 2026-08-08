package com.voiceid.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class VoiceIdApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_CALLS,
                    "Voice calls",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Incoming and ongoing VoiceID calls" }
            )
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_GENERAL,
                    "Messages & notifications",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply { description = "New messages, friend requests, and other activity" }
            )
        }
    }

    companion object {
        const val CHANNEL_CALLS = "voiceid_calls"
        const val CHANNEL_GENERAL = "voiceid_general"
    }
}
