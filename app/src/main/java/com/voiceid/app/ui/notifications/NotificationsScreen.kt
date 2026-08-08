package com.voiceid.app.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.voiceid.app.data.model.AppNotification
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.data.repository.NotificationNav
import com.voiceid.app.di.AppContainer
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.decodeRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class NotificationsViewModel : ViewModel() {
    private val notificationRepository = AppContainer.notificationRepository

    private val _notifications = MutableStateFlow<List<AppNotification>>(emptyList())
    val notifications: StateFlow<List<AppNotification>> = _notifications.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _isLoading.value = true
            _notifications.value = notificationRepository.latest()
            _isLoading.value = false
        }
        val userId = SupabaseModule.currentUserId() ?: return
        viewModelScope.launch {
            notificationRepository.realtimeNotifications(userId).collect { action ->
                if (action is PostgresAction.Insert) {
                    val notif = action.decodeRecord<AppNotification>()
                    _notifications.value = listOf(notif) + _notifications.value
                }
            }
        }
    }

    fun markRead(notification: AppNotification) {
        viewModelScope.launch {
            notificationRepository.markRead(notification.id)
            _notifications.value = _notifications.value.map { if (it.id == notification.id) it.copy(isRead = true) else it }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            notificationRepository.markAllRead()
            _notifications.value = _notifications.value.map { it.copy(isRead = true) }
        }
    }

    fun clearAll() {
        viewModelScope.launch {
            notificationRepository.clearAll()
            _notifications.value = emptyList()
        }
    }
}

@Composable
fun NotificationsScreen(
    notifications: List<AppNotification>,
    isLoading: Boolean,
    onNotificationClick: (AppNotification) -> Unit,
    onMarkAllRead: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications") },
                actions = { TextButton(onClick = onMarkAllRead) { Text("Mark all read") } }
            )
        }
    ) { padding ->
        when {
            isLoading -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            notifications.isEmpty() -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("You're all caught up.")
            }
            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(notifications, key = { it.id }) { notif ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNotificationClick(notif) }
                            .background(if (!notif.isRead) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f) else MaterialTheme.colorScheme.background)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Box(
                            modifier = Modifier.size(8.dp).clip(CircleShape)
                                .background(if (!notif.isRead) MaterialTheme.colorScheme.primary else androidx.compose.ui.graphics.Color.Transparent)
                                .align(Alignment.CenterVertically)
                        )
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(notif.title, style = MaterialTheme.typography.titleMedium)
                            Text(notif.message, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
