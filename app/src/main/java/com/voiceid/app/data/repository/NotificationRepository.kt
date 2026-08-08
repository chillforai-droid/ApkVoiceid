package com.voiceid.app.data.repository

import com.voiceid.app.data.model.AppNotification
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow

/**
 * Implements API_REFERENCE.md §3.8. There is NO client INSERT path for notifications — rows
 * are created only by SECURITY DEFINER Postgres triggers (BACKEND_README.md §5.2/§8). This
 * repository only reads/updates/deletes, exactly like the web client.
 */
class NotificationRepository {

    private val client = SupabaseModule.client()

    suspend fun latest(limit: Int = 30): List<AppNotification> {
        val userId = SupabaseModule.currentUserId() ?: return emptyList()
        return client.from("notifications").select {
            filter { eq("user_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }.decodeList()
    }

    suspend fun fetchMore(beforeCreatedAt: String, limit: Int = 30): List<AppNotification> {
        val userId = SupabaseModule.currentUserId() ?: return emptyList()
        return client.from("notifications").select {
            filter {
                eq("user_id", userId)
                lt("created_at", beforeCreatedAt)
            }
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }.decodeList()
    }

    /** channel `realtime:notifications`, filter user_id=eq.{self} — API_REFERENCE.md §4. */
    fun realtimeNotifications(userId: String): Flow<PostgresAction> {
        val channel = client.realtime.channel("realtime:notifications")
        return channel.postgresChangeFlow(schema = "public") {
            table = "notifications"
            filter("user_id", FilterOperator.EQ, userId)
        }
    }

    suspend fun markRead(notificationId: String) {
        client.from("notifications").update({ set("is_read", true) }) {
            filter { eq("id", notificationId) }
        }
    }

    suspend fun markAllRead() {
        val userId = SupabaseModule.currentUserId() ?: return
        client.from("notifications").update({ set("is_read", true) }) {
            filter {
                eq("user_id", userId)
                eq("is_read", false)
            }
        }
    }

    /** "mark conversation read" — used when the ChatPage equivalent screen is opened, per BACKEND_README §8. */
    suspend fun markConversationRead(conversationId: String) {
        val userId = SupabaseModule.currentUserId() ?: return
        client.from("notifications").update({ set("is_read", true) }) {
            filter {
                eq("user_id", userId)
                eq("related_id", conversationId)
                eq("type", "message")
                eq("is_read", false)
            }
        }
    }

    suspend fun delete(notificationId: String) {
        client.from("notifications").delete { filter { eq("id", notificationId) } }
    }

    suspend fun clearAll() {
        val userId = SupabaseModule.currentUserId() ?: return
        client.from("notifications").delete { filter { eq("user_id", userId) } }
    }
}

/**
 * Route/icon registry — the Android equivalent of src/lib/notificationNav.ts. Adding a new
 * notification type requires updating BOTH this and the trigger, per AI_HANDOFF.md §1.3.
 */
object NotificationNav {
    enum class Route { HOME_CHAT, CONTACTS, CALL_HISTORY, NONE }

    fun routeFor(type: String): Route = when (type) {
        "message" -> Route.HOME_CHAT
        "friend_request", "friend_accepted" -> Route.CONTACTS
        "missed_call" -> Route.CALL_HISTORY
        else -> Route.NONE
    }
}
