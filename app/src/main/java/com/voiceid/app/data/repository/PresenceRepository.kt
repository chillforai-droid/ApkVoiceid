package com.voiceid.app.data.repository

import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.presenceDataFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock
import kotlinx.serialization.Serializable

@Serializable
data class PresenceRecord(val user_id: String, val online_at: String)

/**
 * Implements BACKEND_README.md §6.2 exactly: a SINGLE global channel `voiceid:online-users`
 * for the whole app, using the `sync` presence event flattened into a Set<String> of online
 * user ids. Do NOT create per-conversation presence channels — that fragments the online/
 * offline signal, per the explicit warning in the doc.
 */
class PresenceRepository {

    private val client = SupabaseModule.client()
    private var channel: RealtimeChannel? = null

    private val _onlineUsers = MutableStateFlow<Set<String>>(emptySet())
    val onlineUsers: StateFlow<Set<String>> = _onlineUsers.asStateFlow()

    /** Call once from an app-scoped CoroutineScope (e.g. a ViewModel tied to app lifetime) after login. */
    suspend fun start(scope: CoroutineScope) {
        val userId = SupabaseModule.currentUserId() ?: return
        val ch = client.channel("voiceid:online-users")
        channel = ch

        scope.launch {
            ch.presenceDataFlow<PresenceRecord>().collect { presenceState ->
                _onlineUsers.value = presenceState.map { it.user_id }.toSet()
            }
        }

        ch.subscribe(blockUntilSubscribed = true)
        ch.track(PresenceRecord(user_id = userId, online_at = Clock.System.now().toString()))
    }

    fun isOnline(userId: String): Boolean = _onlineUsers.value.contains(userId)

    suspend fun stop() {
        channel?.let { client.realtime.removeChannel(it) }
        channel = null
        _onlineUsers.value = emptySet()
    }
}
