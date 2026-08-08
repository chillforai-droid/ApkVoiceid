package com.voiceid.app.data.repository

import com.voiceid.app.data.model.Contact
import com.voiceid.app.data.model.ContactInsert
import com.voiceid.app.data.model.Profile
import com.voiceid.app.data.remote.SupabaseModule
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order

/** Implements API_REFERENCE.md §3.5 exactly — do not add client-side notification inserts. */
class ContactRepository {

    private val client = SupabaseModule.client()

    suspend fun sendFriendRequest(responderId: String) {
        val userId = SupabaseModule.currentUserId() ?: throw AuthException("Not authenticated")
        client.from("contacts").insert(ContactInsert(requesterId = userId, responderId = responderId))
    }

    suspend fun acceptRequest(contactId: String) {
        client.from("contacts").update({ set("status", "accepted") }) {
            filter { eq("id", contactId) }
        }
    }

    suspend fun declineOrBlock(contactId: String) {
        client.from("contacts").update({ set("status", "blocked") }) {
            filter { eq("id", contactId) }
        }
    }

    suspend fun removeContact(contactId: String) {
        client.from("contacts").delete { filter { eq("id", contactId) } }
    }

    /** SELECT * FROM contacts WHERE requester_id = auth.uid() OR responder_id = auth.uid() */
    suspend fun myContacts(): List<Contact> {
        val userId = SupabaseModule.currentUserId() ?: return emptyList()
        return client.from("contacts").select {
            filter {
                or {
                    eq("requester_id", userId)
                    eq("responder_id", userId)
                }
            }
            order("created_at", Order.DESCENDING)
        }.decodeList()
    }

    suspend fun profileById(userId: String): Profile? =
        client.from("profiles").select { filter { eq("id", userId) } }.decodeSingleOrNull()

    suspend fun profilesByIds(ids: List<String>): List<Profile> {
        if (ids.isEmpty()) return emptyList()
        return client.from("profiles").select {
            filter { isIn("id", ids) }
        }.decodeList()
    }

    /**
     * SELECT * FROM profiles WHERE (username ILIKE '%q%' OR display_name ILIKE '%q%') AND id <> auth.uid()
     * ORDER BY username LIMIT/OFFSET (via range()) — same `profiles` search from API_REFERENCE.md §3.9,
     * extended with self-exclusion and range()-based pagination. No schema or endpoint change.
     *
     * Accepts a leading "@" and surrounding whitespace so "@name", " @name ", and "name" all match
     * the same way; ILIKE already makes the match case-insensitive.
     */
    suspend fun searchUsers(query: String, limit: Int = 20, offset: Int = 0): List<Profile> {
        val trimmed = query.trim().removePrefix("@").trim()
        if (trimmed.isBlank()) return emptyList()
        val selfId = SupabaseModule.currentUserId()
        return client.from("profiles").select {
            filter {
                or {
                    ilike("username", "%$trimmed%")
                    ilike("display_name", "%$trimmed%")
                }
                if (selfId != null) neq("id", selfId)
            }
            order("username", Order.ASCENDING)
            range(offset.toLong(), (offset + limit - 1).toLong())
        }.decodeList()
    }
}
