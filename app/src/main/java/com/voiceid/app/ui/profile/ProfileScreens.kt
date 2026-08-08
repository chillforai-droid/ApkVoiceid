package com.voiceid.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.voiceid.app.data.model.Profile
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

class ProfileViewModel : ViewModel() {
    private val authRepository = AppContainer.authRepository
    private val profileRepository = AppContainer.profileRepository

    private val _profile = MutableStateFlow<Profile?>(null)
    val profile: StateFlow<Profile?> = _profile.asStateFlow()

    private val _isSaving = MutableStateFlow(false)
    val isSaving: StateFlow<Boolean> = _isSaving.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun load() {
        viewModelScope.launch { _profile.value = authRepository.fetchOwnProfile() }
    }

    fun save(displayName: String, bio: String, avatarFile: File?, cloudName: String, onDone: () -> Unit) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                val avatarUrl = avatarFile?.let { profileRepository.uploadAvatar(it, cloudName) }
                profileRepository.updateProfile(displayName, bio, avatarUrl)
                _profile.value = authRepository.fetchOwnProfile()
                onDone()
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isSaving.value = false
            }
        }
    }
}

@Composable
fun ProfileScreen(profile: Profile?, onEditClick: () -> Unit, onSettingsClick: () -> Unit, onSignOut: () -> Unit) {
    Scaffold(topBar = { TopAppBar(title = { Text("Profile") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AsyncImage(
                model = profile?.avatarUrl,
                contentDescription = null,
                modifier = Modifier.size(96.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer)
            )
            Spacer(Modifier.height(16.dp))
            Text(profile?.displayName ?: "Your name", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("@${profile?.username ?: ""}", style = MaterialTheme.typography.bodyMedium)
            if (!profile?.bio.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(profile?.bio.orEmpty(), style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(32.dp))
            Button(onClick = onEditClick, modifier = Modifier.fillMaxWidth()) { Text("Edit profile") }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onSettingsClick, modifier = Modifier.fillMaxWidth()) { Text("Settings") }
            Spacer(Modifier.height(12.dp))
            TextButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) {
                Text("Sign out", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
fun EditProfileScreen(
    profile: Profile?,
    isSaving: Boolean,
    errorMessage: String?,
    onPickAvatar: () -> Unit,
    pendingAvatarFile: File?,
    onSave: (displayName: String, bio: String) -> Unit,
    onBack: () -> Unit
) {
    var displayName by remember(profile) { mutableStateOf(profile?.displayName.orEmpty()) }
    var bio by remember(profile) { mutableStateOf(profile?.bio.orEmpty()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit profile") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Cancel") } }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                AsyncImage(
                    model = pendingAvatarFile ?: profile?.avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.size(96.dp).clip(CircleShape)
                        .background(MaterialTheme.colorScheme.secondaryContainer)
                )
            }
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onPickAvatar, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Change photo")
            }
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(value = displayName, onValueChange = { displayName = it }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(value = bio, onValueChange = { bio = it }, label = { Text("Bio") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            if (errorMessage != null) {
                Spacer(Modifier.height(8.dp))
                Text(errorMessage, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = { onSave(displayName, bio) },
                enabled = !isSaving,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (isSaving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Save changes")
            }
        }
    }
}
