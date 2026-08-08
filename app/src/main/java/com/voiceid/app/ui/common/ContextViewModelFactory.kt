package com.voiceid.app.ui.common

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.voiceid.app.ui.call.CallViewModel
import com.voiceid.app.ui.chat.ChatViewModel
import com.voiceid.app.ui.settings.SettingsViewModel

class ContextViewModelFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(ChatViewModel::class.java) -> ChatViewModel(context.applicationContext) as T
            modelClass.isAssignableFrom(CallViewModel::class.java) -> CallViewModel(context.applicationContext) as T
            modelClass.isAssignableFrom(SettingsViewModel::class.java) -> SettingsViewModel(context.applicationContext) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}
