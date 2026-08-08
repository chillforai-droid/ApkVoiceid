package com.voiceid.app.di

import com.voiceid.app.data.repository.AuthRepository
import com.voiceid.app.data.repository.CallRepository
import com.voiceid.app.data.repository.ContactRepository
import com.voiceid.app.data.repository.ConversationRepository
import com.voiceid.app.data.repository.MessageRepository
import com.voiceid.app.data.repository.NotificationRepository
import com.voiceid.app.data.repository.PresenceRepository
import com.voiceid.app.data.repository.ProfileRepository

/**
 * Deliberately simple manual dependency graph (no Hilt/Dagger) — this app has a small,
 * flat set of singleton repositories, and avoiding an annotation processor keeps Gradle/CI
 * builds fast and predictable. Mirrors what the web app does with plain module-level
 * singletons (see src/lib/supabase.ts).
 */
object AppContainer {
    val authRepository: AuthRepository by lazy { AuthRepository() }
    val profileRepository: ProfileRepository by lazy { ProfileRepository() }
    val contactRepository: ContactRepository by lazy { ContactRepository() }
    val conversationRepository: ConversationRepository by lazy { ConversationRepository() }
    val messageRepository: MessageRepository by lazy { MessageRepository() }
    val callRepository: CallRepository by lazy { CallRepository() }
    val notificationRepository: NotificationRepository by lazy { NotificationRepository() }
    val presenceRepository: PresenceRepository by lazy { PresenceRepository() }
}
