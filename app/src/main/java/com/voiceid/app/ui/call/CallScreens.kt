package com.voiceid.app.ui.call

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.voiceid.app.call.CallState
import kotlinx.coroutines.delay

@Composable
fun IncomingCallScreen(callerName: String, onAccept: () -> Unit, onReject: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier.size(120.dp).clip(CircleShape).background(Color(0xFF4F46E5)),
                contentAlignment = Alignment.Center
            ) {
                Text(callerName.take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.titleLarge)
            }
            Spacer(Modifier.height(24.dp))
            Text(callerName, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text("Incoming VoiceID call…", color = Color.White.copy(alpha = 0.7f))
            Spacer(Modifier.height(64.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(48.dp)) {
                CallActionButton(icon = Icons.Filled.CallEnd, backgroundColor = Color(0xFFEF4444), onClick = onReject)
                CallActionButton(icon = Icons.Filled.Call, backgroundColor = Color(0xFF22C55E), onClick = onAccept)
            }
        }
    }
}

@Composable
fun ActiveCallScreen(
    otherUserName: String,
    callState: CallState,
    onEndCall: () -> Unit,
    onToggleMute: (Boolean) -> Unit
) {
    var muted by remember { mutableStateOf(false) }
    var seconds by remember { mutableStateOf(0) }

    LaunchedEffect(callState) {
        if (callState == CallState.ACTIVE) {
            while (true) {
                delay(1000)
                seconds++
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0F172A)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier.size(120.dp).clip(CircleShape).background(Color(0xFF4F46E5)),
                contentAlignment = Alignment.Center
            ) {
                Text(otherUserName.take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.titleLarge)
            }
            Spacer(Modifier.height(24.dp))
            Text(otherUserName, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                when (callState) {
                    CallState.OUTGOING_RINGING -> "Ringing…"
                    CallState.CONNECTING -> "Connecting…"
                    CallState.ACTIVE -> formatDuration(seconds)
                    else -> "Call ended"
                },
                color = Color.White.copy(alpha = 0.7f)
            )
            Spacer(Modifier.height(64.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                CallActionButton(
                    icon = if (muted) Icons.Filled.MicOff else Icons.Filled.Mic,
                    backgroundColor = Color.White.copy(alpha = 0.15f),
                    onClick = { muted = !muted; onToggleMute(muted) }
                )
                CallActionButton(icon = Icons.Filled.CallEnd, backgroundColor = Color(0xFFEF4444), onClick = onEndCall)
            }
        }
    }
}

@Composable
private fun CallActionButton(icon: androidx.compose.ui.graphics.vector.ImageVector, backgroundColor: Color, onClick: () -> Unit) {
    IconButton(
        onClick = onClick,
        modifier = Modifier.size(64.dp).clip(CircleShape).background(backgroundColor)
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
    }
}

private fun formatDuration(totalSeconds: Int): String {
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "%d:%02d".format(m, s)
}
