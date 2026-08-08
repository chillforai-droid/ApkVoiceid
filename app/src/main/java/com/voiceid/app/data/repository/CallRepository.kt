package com.voiceid.app.data.repository

import com.voiceid.app.data.model.Call
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlin.time.Clock

/** Implements API_REFERENCE.md §3.7 + BACKEND_README.md §6.3 DB-row side of the call state machine. */
class CallRepository {

    private val client = SupabaseModule.client()

    suspend fun createRingingCall(receiverId: String): Call {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        return client.from("calls").insert(
            mapOf("caller_id" to userId, "receiver_id" to receiverId, "status" to "ringing")
        ) { select() }.decodeSingle()
    }

    suspend fun markAccepted(callId: String) {
        client.from("calls").update({
            set("status", "accepted")
            set("answered_at", Clock.System.now().toString())
        }) { filter { eq("id", callId) } }
    }

    suspend fun markRejected(callId: String) {
        client.from("calls").update({ set("status", "rejected") }) { filter { eq("id", callId) } }
    }

    suspend fun markEnded(callId: String) {
        client.from("calls").update({
            set("status", "ended")
            set("ended_at", Clock.System.now().toString())
        }) { filter { eq("id", callId) } }
    }

    suspend fun markMissed(callId: String) {
        client.from("calls").update({
            set("status", "missed")
            set("ended_at", Clock.System.now().toString())
        }) { filter { eq("id", callId) } }
    }

    suspend fun markCancelled(callId: String) {
        client.from("calls").update({ set("status", "cancelled") }) { filter { eq("id", callId) } }
    }

    /** channel `calls:{userId}`, INSERT filtered receiver_id=eq.{self} — incoming call detection, §4. */
    fun incomingCallFlow(userId: String): Flow<PostgresAction> {
        val channel = client.realtime.channel("calls:$userId")
        return channel.postgresChangeFlow(schema = "public") {
            table = "calls"
            filter("receiver_id", FilterOperator.EQ, userId)
        }
    }

    /** channel `call-history-updates`, `*` on calls — §4/§6.1. */
    fun callHistoryUpdatesFlow(): Flow<PostgresAction> {
        val channel = client.realtime.channel("call-history-updates")
        return channel.postgresChangeFlow(schema = "public") { table = "calls" }
    }

    suspend fun callHistory(userId: String, limit: Int = 100): List<Call> =
        client.from("calls").select {
            filter {
                or {
                    eq("caller_id", userId)
                    eq("receiver_id", userId)
                }
            }
            order("created_at", Order.DESCENDING)
            limit(limit.toLong())
        }.decodeList()
}
