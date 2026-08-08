package com.voiceid.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.voiceid.app.data.model.ConversationSummary
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {

    private val conversationRepository = AppContainer.conversationRepository
    private val presenceRepository = AppContainer.presenceRepository
    private val notificationRepository = AppContainer.notificationRepository

    private val _conversations = MutableStateFlow<List<ConversationSummary>>(emptyList())
    val conversations: StateFlow<List<ConversationSummary>> = _conversations.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _unreadMessageCount = MutableStateFlow(0)
    val unreadMessageCount: StateFlow<Int> = _unreadMessageCount.asStateFlow()

    init {
        viewModelScope.launch { presenceRepository.start(viewModelScope) }
        refresh()
        observeUnread()
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _conversations.value = conversationRepository.conversationSummaries(presenceRepository.onlineUsers.value)
            _isLoading.value = false
        }
    }

    private fun observeUnread() {
        viewModelScope.launch {
            val all = notificationRepository.latest(50)
            _unreadMessageCount.value = all.count { it.type == "message" && !it.isRead }
        }
    }
}
