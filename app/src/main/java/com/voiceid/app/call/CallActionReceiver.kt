package com.voiceid.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Handles Accept/Reject actions tapped directly from a heads-up incoming-call notification,
 * without requiring the user to open the app first.
 */
class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_ACCEPT -> context.sendBroadcast(Intent(BROADCAST_ACCEPT))
            ACTION_REJECT -> context.sendBroadcast(Intent(BROADCAST_REJECT))
        }
    }

    companion object {
        const val ACTION_ACCEPT = "com.voiceid.app.action.ACCEPT_CALL"
        const val ACTION_REJECT = "com.voiceid.app.action.REJECT_CALL"
        const val BROADCAST_ACCEPT = "com.voiceid.app.broadcast.CALL_ACCEPTED"
        const val BROADCAST_REJECT = "com.voiceid.app.broadcast.CALL_REJECTED"
    }
}
