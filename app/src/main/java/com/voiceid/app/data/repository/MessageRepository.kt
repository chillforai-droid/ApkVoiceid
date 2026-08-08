package com.voiceid.app.data.repository

import com.voiceid.app.data.model.Message
import com.voiceid.app.data.remote.MediaApi
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.File
import java.security.MessageDigest
import java.util.UUID

class MessageRepository(private val mediaApi: MediaApi = MediaApi()) {

    private val client = SupabaseModule.client()

    suspend fun history(conversationId: String, limit: Int = 100): List<Message> =
        client.from("messages").select {
            filter { eq("conversation_id", conversationId) }
            order("created_at", Order.ASCENDING)
            limit(limit.toLong())
        }.decodeList()

    /**
     * Subscribes to `messages:{conversationId}` postgres_changes exactly as documented in
     * API_REFERENCE.md §4 / BACKEND_README.md §6.1 — channel name is a cross-client
     * compatibility surface, must not be altered.
     */
    suspend fun realtimeMessages(conversationId: String): Flow<PostgresAction> {
        val channel = client.realtime.channel("messages:$conversationId")
        val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "messages"
            filter("conversation_id", FilterOperator.EQ, conversationId)
        }
        channel.subscribe(blockUntilSubscribed = true)
        return flow
    }

    /** INSERT INTO messages (...) VALUES (..., 'text') — API_REFERENCE.md §3.2. */
    suspend fun sendText(conversationId: String, body: String) {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        client.from("messages").insert(
            mapOf(
                "conversation_id" to conversationId,
                "sender_id" to userId,
                "content_body" to body,
                "content_type" to "text"
            )
        )
    }

    /**
     * Voice message: upload raw bytes to /api/media/upload (§1.1), then INSERT the messages
     * row per §3.3 — duration REQUIRED (1-120s), matching the valid_voice_metadata CHECK.
     */
    suspend fun sendVoice(conversationId: String, file: File, durationSeconds: Int, mimeType: String) {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        val token = SupabaseModule.currentAccessToken() ?: throw AuthException("No session token")
        require(durationSeconds in 1..120) { "Voice message duration must be 1-120 seconds" }

        val sha256 = sha256Hex(file)
        val upload = mediaApi.uploadRaw(token, file, mimeType)
        val messageId = UUID.randomUUID().toString() // client-generated, per §3.3

        client.from("messages").insert(
            mapOf(
                "id" to messageId,
                "conversation_id" to conversationId,
                "sender_id" to userId,
                "content_type" to "voice",
                "b2_object_key" to upload.objectKey,
                "sha256" to sha256,
                "media_status" to "pending",
                "duration" to durationSeconds,
                "mime_type" to mimeType,
                "byte_size" to file.length()
            )
        )
    }

    /** Image message: same upload path, media_status set to 'delivered' immediately per §3.3/§7.2. */
    suspend fun sendImage(conversationId: String, file: File, mimeType: String) {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        val token = SupabaseModule.currentAccessToken() ?: throw AuthException("No session token")

        val sha256 = sha256Hex(file)
        val upload = mediaApi.uploadRaw(token, file, mimeType)

        client.from("messages").insert(
            mapOf(
                "conversation_id" to conversationId,
                "sender_id" to userId,
                "content_type" to "image",
                "b2_object_key" to upload.objectKey,
                "sha256" to sha256,
                "media_status" to "delivered",
                "mime_type" to mimeType,
                "byte_size" to file.length()
            )
        )
    }

    /** Recipient-side media fetch + best-effort ack, per §1.3/§1.4/§7.3. */
    suspend fun downloadMedia(messageId: String): ByteArray {
        val token = SupabaseModule.currentAccessToken() ?: throw AuthException("No session token")
        val auth = mediaApi.requestDownloadAuth(token, messageId)
        val bytes = mediaApi.downloadBytes(auth.url)
        mediaApi.ackDelivery(token, messageId) // fire-and-forget, 403-for-sender is expected/non-fatal
        return bytes
    }

    /** Sender-initiated delete: DB row first, then B2 object — §3.4/§7.4. */
    suspend fun deleteMessage(message: Message) {
        val token = SupabaseModule.currentAccessToken()
        val deleted = client.from("messages").delete {
            filter { eq("id", message.id) }
            select()
        }.decodeList<Message>()
        if (deleted.isEmpty()) throw AuthException("Delete was blocked (not the sender)")
        if (message.b2ObjectKey != null && token != null) {
            mediaApi.deleteObject(token, message.b2ObjectKey)
        }
    }

    suspend fun editMessage(messageId: String, newBody: String) {
        val updated = client.from("messages").update({ set("content_body", newBody) }) {
            filter { eq("id", messageId) }
            select()
        }.decodeList<Message>()
        if (updated.isEmpty()) throw AuthException("Edit was blocked (not the sender)")
    }

    private fun sha256Hex(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            var read: Int
            while (input.read(buffer).also { read = it } != -1) digest.update(buffer, 0, read)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
