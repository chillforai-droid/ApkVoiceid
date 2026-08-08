package com.voiceid.app.data.repository

import com.voiceid.app.data.model.Conversation
import com.voiceid.app.data.model.ConversationMember
import com.voiceid.app.data.model.ConversationSummary
import com.voiceid.app.data.model.Message
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc

class ConversationRepository(private val contactRepository: ContactRepository = ContactRepository()) {

    private val client = SupabaseModule.client()

    /** RPC create_private_conversation(other_user_id) — API_REFERENCE.md §3.6. */
    suspend fun createOrGetPrivateConversation(otherUserId: String): String {
        return client.postgrest.rpc(
            "create_private_conversation",
            mapOf("other_user_id" to otherUserId)
        ).data.trim('"')
    }

    /** SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid() */
    private suspend fun myConversationIds(): List<String> {
        val userId = SupabaseModule.currentUserId() ?: return emptyList()
        return client.from("conversation_members").select {
            filter { eq("user_id", userId) }
        }.decodeList<ConversationMember>().map { it.conversationId }
    }

    /**
     * Builds the HomePage conversation list: conversation + other participant + last message
     * preview, mirroring the join used by ConversationsPage in the web client (§3.6).
     */
    suspend fun conversationSummaries(onlineUserIds: Set<String>): List<ConversationSummary> {
        val userId = SupabaseModule.currentUserId() ?: return emptyList()
        val convIds = myConversationIds()
        if (convIds.isEmpty()) return emptyList()

        val conversations = client.from("conversations").select {
            filter { isIn("id", convIds) }
            order("last_message_at", Order.DESCENDING)
        }.decodeList<Conversation>()

        val members = client.from("conversation_members").select {
            filter { isIn("conversation_id", convIds) }
        }.decodeList<ConversationMember>()

        val otherUserIdByConv = members
            .filter { it.userId != userId }
            .associate { it.conversationId to it.userId }

        val profiles = contactRepository.profilesByIds(otherUserIdByConv.values.distinct())
            .associateBy { it.id }

        return conversations.mapNotNull { conv ->
            val otherId = otherUserIdByConv[conv.id] ?: return@mapNotNull null
            val other = profiles[otherId] ?: return@mapNotNull null

            val lastMessage = client.from("messages").select {
                filter { eq("conversation_id", conv.id) }
                order("created_at", Order.DESCENDING)
                limit(1)
            }.decodeSingleOrNull<Message>()

            val preview = when (lastMessage?.contentType) {
                "voice" -> "🎤 Voice message"
                "image" -> "📷 Photo"
                "text" -> lastMessage.contentBody.orEmpty()
                else -> ""
            }

            ConversationSummary(
                conversation = conv,
                otherUser = other,
                lastMessagePreview = preview,
                lastMessageAt = conv.lastMessageAt,
                isOnline = onlineUserIds.contains(otherId),
                unreadCount = 0 // derived from NotificationRepository in the ViewModel layer
            )
        }
    }
}
