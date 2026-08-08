package com.voiceid.app.ui.call

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.voiceid.app.call.CallState
import com.voiceid.app.call.WebRtcCallManager
import com.voiceid.app.data.model.Call
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.di.AppContainer
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.decodeRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class CallViewModel(context: Context) : ViewModel() {

    private val callRepository = AppContainer.callRepository
    private val contactRepository = AppContainer.contactRepository
    val callManager = WebRtcCallManager(context, viewModelScope)

    val callState: StateFlow<CallState> = callManager.callState

    private val _incomingCall = MutableStateFlow<Call?>(null)
    val incomingCall: StateFlow<Call?> = _incomingCall.asStateFlow()

    private val _incomingCallerName = MutableStateFlow<String?>(null)
    val incomingCallerName: StateFlow<String?> = _incomingCallerName.asStateFlow()

    /** Listen on `calls:{userId}` for new rows where receiver_id = self — API_REFERENCE.md §4. */
    fun startListeningForIncomingCalls() {
        val userId = SupabaseModule.currentUserId() ?: return
        viewModelScope.launch {
            callRepository.incomingCallFlow(userId).collect { action ->
                if (action is PostgresAction.Insert) {
                    val call = action.decodeRecord<Call>()
                    if (call.status == "ringing" && call.receiverId == userId) {
                        _incomingCall.value = call
                        callManager.setIncomingCall(call)
                        val caller = contactRepository.profileById(call.callerId)
                        _incomingCallerName.value = caller?.displayName ?: caller?.username ?: "Unknown"
                    }
                }
            }
        }
    }

    fun startOutgoingCall(receiverId: String) = callManager.startOutgoingCall(receiverId)

    fun acceptIncomingCall() {
        _incomingCall.value?.let { callManager.acceptIncomingCall(it) }
        _incomingCall.value = null
    }

    fun rejectIncomingCall() {
        _incomingCall.value?.let { callManager.rejectIncomingCall(it) }
        _incomingCall.value = null
    }

    fun endCall() {
        viewModelScope.launch { callManager.endCall() }
    }

    fun cancelOutgoing() {
        viewModelScope.launch { callManager.cancelOutgoing() }
    }

    fun toggleMute(muted: Boolean) = callManager.toggleMute(muted)
}
