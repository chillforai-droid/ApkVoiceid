package com.voiceid.app.ui.chat

import android.Manifest
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.voiceid.app.data.model.Message
import com.voiceid.app.media.VoiceMessagePlayer
import com.voiceid.app.media.VoiceRecorderController
import kotlinx.coroutines.delay
import java.io.File

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun ChatScreen(
    otherUserName: String,
    otherUserOnline: Boolean,
    messages: List<Message>,
    selfUserId: String?,
    isSending: Boolean,
    onSendText: (String) -> Unit,
    onSendVoice: (File, Int) -> Unit,
    onSendImage: (File) -> Unit,
    onMediaRequested: (Message, (File) -> Unit) -> Unit,
    onDeleteMessage: (Message) -> Unit,
    onCallClick: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var textInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val recorder = remember { VoiceRecorderController(context) }
    val isRecording by recorder.isRecording.collectAsState()
    val elapsedSeconds by recorder.elapsedSeconds.collectAsState()

    val micPermission = rememberPermissionState(Manifest.permission.RECORD_AUDIO)

    LaunchedEffect(isRecording) {
        while (isRecording) {
            recorder.tick()
            delay(200)
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            val file = File(context.cacheDir, "image_${System.currentTimeMillis()}.jpg")
            context.contentResolver.openInputStream(it)?.use { input -> file.outputStream().use { out -> input.copyTo(out) } }
            onSendImage(file)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(otherUserName)
                        Text(
                            if (otherUserOnline) "Online" else "Offline",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (otherUserOnline) Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
                actions = {
                    IconButton(onClick = onCallClick) { Icon(Icons.Filled.Call, contentDescription = "Call") }
                }
            )
        },
        bottomBar = {
            Surface(shadowElevation = 4.dp) {
                Column {
                    if (isRecording) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Filled.Mic, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(8.dp))
                            Text("Recording… ${elapsedSeconds}s / ${VoiceRecorderController.MAX_DURATION_SECONDS}s")
                            Spacer(Modifier.weight(1f))
                            TextButton(onClick = { recorder.cancel() }) { Text("Cancel") }
                            Button(onClick = {
                                recorder.stop()?.let { (file, duration) -> onSendVoice(file, duration) }
                            }) { Text("Send") }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(onClick = { imagePicker.launch("image/*") }) {
                                Icon(Icons.Filled.Image, contentDescription = "Send image")
                            }
                            OutlinedTextField(
                                value = textInput,
                                onValueChange = { textInput = it },
                                placeholder = { Text("Message") },
                                modifier = Modifier.weight(1f),
                                maxLines = 4
                            )
                            Spacer(Modifier.width(4.dp))
                            if (textInput.isNotBlank()) {
                                IconButton(
                                    onClick = { onSendText(textInput); textInput = "" },
                                    enabled = !isSending
                                ) { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send") }
                            } else {
                                IconButton(onClick = {
                                    if (micPermission.status.isGranted) {
                                        recorder.start()
                                    } else {
                                        micPermission.launchPermissionRequest()
                                    }
                                }) { Icon(Icons.Filled.Mic, contentDescription = "Record voice message") }
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                MessageBubble(
                    message = message,
                    isMine = message.senderId == selfUserId,
                    onMediaRequested = onMediaRequested,
                    onDelete = { onDeleteMessage(message) }
                )
            }
        }
    }
}

@Composable
private fun MessageBubble(
    message: Message,
    isMine: Boolean,
    onMediaRequested: (Message, (File) -> Unit) -> Unit,
    onDelete: () -> Unit
) {
    var showDeleteMenu by remember { mutableStateOf(false) }
    val bubbleColor = if (isMine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val textColor = if (isMine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
        Box {
            Surface(
                color = bubbleColor,
                shape = RoundedCornerShape(
                    topStart = 16.dp, topEnd = 16.dp,
                    bottomStart = if (isMine) 16.dp else 4.dp,
                    bottomEnd = if (isMine) 4.dp else 16.dp
                ),
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .pointerInput(message.id) {
                        detectTapGestures(onLongPress = { if (isMine) showDeleteMenu = true })
                    }
            ) {
                Box(modifier = Modifier.padding(10.dp)) {
                    when (message.contentType) {
                        "text" -> Text(message.contentBody.orEmpty(), color = textColor)
                        "voice" -> VoiceMessageContent(message, textColor, onMediaRequested)
                        "image" -> ImageMessageContent(message, onMediaRequested)
                        else -> Text("Unsupported message", color = textColor)
                    }
                }
            }
            DropdownMenu(expanded = showDeleteMenu, onDismissRequest = { showDeleteMenu = false }) {
                DropdownMenuItem(text = { Text("Delete") }, onClick = { showDeleteMenu = false; onDelete() })
            }
        }
    }
}

@Composable
private fun VoiceMessageContent(
    message: Message,
    textColor: Color,
    onMediaRequested: (Message, (File) -> Unit) -> Unit
) {
    val player = remember { VoiceMessagePlayer() }
    val isPlaying by player.isPlaying.collectAsState()
    val progress by player.progress.collectAsState()
    var localFile by remember { mutableStateOf<File?>(null) }

    LaunchedEffect(isPlaying) {
        while (isPlaying) {
            player.updateProgress()
            delay(100)
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = {
            if (isPlaying) {
                player.stop()
            } else if (localFile != null) {
                player.play(localFile!!) {}
            } else {
                onMediaRequested(message) { file -> localFile = file; player.play(file) {} }
            }
        }) {
            Icon(if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, contentDescription = "Play voice message", tint = textColor)
        }
        LinearProgressIndicator(progress = { progress }, modifier = Modifier.width(120.dp))
        Spacer(Modifier.width(8.dp))
        Text("${message.duration ?: 0}s", color = textColor, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ImageMessageContent(message: Message, onMediaRequested: (Message, (File) -> Unit) -> Unit) {
    var localFile by remember { mutableStateOf<File?>(null) }
    LaunchedEffect(message.id) {
        onMediaRequested(message) { file -> localFile = file }
    }
    if (localFile != null) {
        AsyncImage(
            model = localFile,
            contentDescription = "Image message",
            modifier = Modifier.widthIn(max = 240.dp).clip(RoundedCornerShape(12.dp))
        )
    } else {
        Box(modifier = Modifier.size(160.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    }
}
