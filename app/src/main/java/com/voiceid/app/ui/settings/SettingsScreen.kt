package com.voiceid.app.ui.settings

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.voiceid.app.data.model.UserSettings
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.ui.theme.ThemeMode
import com.voiceid.app.ui.theme.ThemePreferences
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(context: Context) : ViewModel() {

    private val themePreferences = ThemePreferences(context.applicationContext)
    private val client = SupabaseModule.client()

    val themeMode: StateFlow<ThemeMode> = MutableStateFlow(ThemeMode.SYSTEM).also { flow ->
        viewModelScope.launch { themePreferences.themeMode.collect { flow.value = it } }
    }.asStateFlow()

    private val _privacySettings = MutableStateFlow<UserSettings?>(null)
    val privacySettings: StateFlow<UserSettings?> = _privacySettings.asStateFlow()

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { themePreferences.setThemeMode(mode) }
    }

    fun loadPrivacySettings() {
        val userId = SupabaseModule.currentUserId() ?: return
        viewModelScope.launch {
            val existing = client.from("user_settings").select { filter { eq("user_id", userId) } }
                .decodeSingleOrNull<UserSettings>()
            _privacySettings.value = existing ?: UserSettings(userId = userId)
        }
    }

    fun updatePrivacySettings(settings: UserSettings) {
        viewModelScope.launch {
            client.from("user_settings").upsert(settings)
            _privacySettings.value = settings
        }
    }
}

@Composable
fun SettingsScreen(
    themeMode: ThemeMode,
    privacySettings: UserSettings?,
    onThemeModeChange: (ThemeMode) -> Unit,
    onPrivacyChange: (UserSettings) -> Unit
) {
    Scaffold(topBar = { TopAppBar(title = { Text("Settings") }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Text("Appearance", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            ThemeMode.values().forEach { mode ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
                ) {
                    RadioButton(selected = themeMode == mode, onClick = { onThemeModeChange(mode) })
                    Spacer(Modifier.width(8.dp))
                    Text(
                        when (mode) {
                            ThemeMode.SYSTEM -> "Match system"
                            ThemeMode.LIGHT -> "Light mode"
                            ThemeMode.DARK -> "Dark mode"
                        }
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))
            Text("Privacy", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            privacySettings?.let { settings ->
                PrivacyRow("Contact requests", settings.contactRequests) {
                    onPrivacyChange(settings.copy(contactRequests = it))
                }
                PrivacyRow("Calls", settings.calls) {
                    onPrivacyChange(settings.copy(calls = it))
                }
                PrivacyRow("Voice messages", settings.voiceMessages) {
                    onPrivacyChange(settings.copy(voiceMessages = it))
                }
                Spacer(Modifier.height(16.dp))
                Text("Notifications", style = MaterialTheme.typography.titleMedium)
                SwitchRow("Contact requests", settings.notifyContactRequests) {
                    onPrivacyChange(settings.copy(notifyContactRequests = it))
                }
                SwitchRow("Messages", settings.notifyMessages) {
                    onPrivacyChange(settings.copy(notifyMessages = it))
                }
                SwitchRow("Calls", settings.notifyCalls) {
                    onPrivacyChange(settings.copy(notifyCalls = it))
                }
            }
        }
    }
}

@Composable
private fun PrivacyRow(label: String, value: String, onChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(label)
        Box {
            TextButton(onClick = { expanded = true }) { Text(value.replaceFirstChar { it.uppercase() }) }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                listOf("everyone", "contacts", "nobody").forEach { option ->
                    DropdownMenuItem(text = { Text(option.replaceFirstChar { it.uppercase() }) }, onClick = { onChange(option); expanded = false })
                }
            }
        }
    }
}

@Composable
private fun SwitchRow(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(label)
        Switch(checked = value, onCheckedChange = onChange)
    }
}
