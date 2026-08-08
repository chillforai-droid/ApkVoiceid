package com.voiceid.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.voiceid.app.data.model.ConversationSummary

@Composable
fun HomeScreen(
    conversations: List<ConversationSummary>,
    isLoading: Boolean,
    onOpenChat: (ConversationSummary) -> Unit,
    onSearchClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("VoiceID", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                conversations.isEmpty() -> EmptyConversationsState(onSearchClick)
                else -> LazyColumn {
                    items(conversations, key = { it.conversation.id }) { summary ->
                        ConversationRow(summary, onClick = { onOpenChat(summary) })
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyConversationsState(onSearchClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("No conversations yet", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Search for a @username to add a contact and start chatting.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onSearchClick) { Text("Find people") }
    }
}

@Composable
private fun ConversationRow(summary: ConversationSummary, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            AsyncImage(
                model = summary.otherUser.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(52.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondaryContainer)
            )
            if (summary.isOnline) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF22C55E))
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                summary.otherUser.displayName ?: "@${summary.otherUser.username}",
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                when {
                    summary.lastMessagePreview.startsWith("🎤") -> Icon(Icons.Filled.Mic, null, modifier = Modifier.size(14.dp))
                    summary.lastMessagePreview.startsWith("📷") -> Icon(Icons.Filled.Image, null, modifier = Modifier.size(14.dp))
                    else -> {}
                }
                Text(
                    summary.lastMessagePreview,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        if (summary.unreadCount > 0) {
            Badge { Text(summary.unreadCount.toString()) }
        }
    }
}
