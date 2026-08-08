package com.voiceid.app.ui.callhistory

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CallMade
import androidx.compose.material.icons.filled.CallMissed
import androidx.compose.material.icons.filled.CallReceived
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.voiceid.app.data.model.Call
import com.voiceid.app.data.model.Profile
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CallHistoryRow(val call: Call, val otherUser: Profile, val isOutgoing: Boolean)

class CallHistoryViewModel : ViewModel() {
    private val callRepository = AppContainer.callRepository
    private val contactRepository = AppContainer.contactRepository

    private val _rows = MutableStateFlow<List<CallHistoryRow>>(emptyList())
    val rows: StateFlow<List<CallHistoryRow>> = _rows.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    fun load() {
        val userId = SupabaseModule.currentUserId() ?: return
        viewModelScope.launch {
            _isLoading.value = true
            val calls = callRepository.callHistory(userId)
            val otherIds = calls.map { if (it.callerId == userId) it.receiverId else it.callerId }.distinct()
            val profiles = contactRepository.profilesByIds(otherIds).associateBy { it.id }
            _rows.value = calls.mapNotNull { call ->
                val otherId = if (call.callerId == userId) call.receiverId else call.callerId
                profiles[otherId]?.let { CallHistoryRow(call, it, isOutgoing = call.callerId == userId) }
            }
            _isLoading.value = false
        }
    }
}

@Composable
fun CallHistoryScreen(rows: List<CallHistoryRow>, isLoading: Boolean, onCallBack: (Profile) -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("Call history") }) }) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        if (rows.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("No calls yet.")
            }
            return@Scaffold
        }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            items(rows) { row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AsyncImage(model = row.otherUser.avatarUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(row.otherUser.displayName ?: "@${row.otherUser.username}")
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val (icon, color) = when {
                                row.call.status == "missed" -> Icons.Filled.CallMissed to Color(0xFFEF4444)
                                row.isOutgoing -> Icons.Filled.CallMade to MaterialTheme.colorScheme.onSurfaceVariant
                                else -> Icons.Filled.CallReceived to MaterialTheme.colorScheme.onSurfaceVariant
                            }
                            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(row.call.status.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.bodyMedium, color = color)
                        }
                    }
                    IconButton(onClick = { onCallBack(row.otherUser) }) {
                        Icon(Icons.Filled.CallMade, contentDescription = "Call back")
                    }
                }
            }
        }
    }
}
