package com.voiceid.app.ui.contacts

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
import coil.compose.AsyncImage
import com.voiceid.app.data.model.Contact
import com.voiceid.app.data.model.Profile
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ContactRow(val contact: Contact, val otherUser: Profile)

class ContactsViewModel : ViewModel() {
    private val contactRepository = AppContainer.contactRepository

    private val _accepted = MutableStateFlow<List<ContactRow>>(emptyList())
    val accepted: StateFlow<List<ContactRow>> = _accepted.asStateFlow()

    private val _incomingRequests = MutableStateFlow<List<ContactRow>>(emptyList())
    val incomingRequests: StateFlow<List<ContactRow>> = _incomingRequests.asStateFlow()

    private val _outgoingRequests = MutableStateFlow<List<ContactRow>>(emptyList())
    val outgoingRequests: StateFlow<List<ContactRow>> = _outgoingRequests.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private var selfUserId: String? = null

    fun load(selfId: String) {
        selfUserId = selfId
        viewModelScope.launch {
            _isLoading.value = true
            val allContacts = contactRepository.myContacts()
            val otherIds = allContacts.map { if (it.requesterId == selfId) it.responderId else it.requesterId }
            val profiles = contactRepository.profilesByIds(otherIds.distinct()).associateBy { it.id }

            _accepted.value = allContacts.filter { it.status == "accepted" }
                .mapNotNull { c -> profiles[if (c.requesterId == selfId) c.responderId else c.requesterId]?.let { ContactRow(c, it) } }

            _incomingRequests.value = allContacts.filter { it.status == "pending" && it.responderId == selfId }
                .mapNotNull { c -> profiles[c.requesterId]?.let { ContactRow(c, it) } }

            _outgoingRequests.value = allContacts.filter { it.status == "pending" && it.requesterId == selfId }
                .mapNotNull { c -> profiles[c.responderId]?.let { ContactRow(c, it) } }

            _isLoading.value = false
        }
    }

    fun accept(contactId: String) {
        viewModelScope.launch {
            contactRepository.acceptRequest(contactId)
            selfUserId?.let { load(it) }
        }
    }

    fun decline(contactId: String) {
        viewModelScope.launch {
            contactRepository.declineOrBlock(contactId)
            selfUserId?.let { load(it) }
        }
    }

    fun remove(contactId: String) {
        viewModelScope.launch {
            contactRepository.removeContact(contactId)
            selfUserId?.let { load(it) }
        }
    }
}

@Composable
fun ContactsScreen(
    accepted: List<ContactRow>,
    incoming: List<ContactRow>,
    outgoing: List<ContactRow>,
    isLoading: Boolean,
    onAccept: (String) -> Unit,
    onDecline: (String) -> Unit
) {
    Scaffold(topBar = { TopAppBar(title = { Text("Contacts") }) }) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (incoming.isNotEmpty()) {
                item { SectionHeader("Friend requests") }
                items(incoming, key = { it.contact.id }) { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(model = row.otherUser.avatarUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(row.otherUser.displayName ?: "@${row.otherUser.username}")
                            Text("@${row.otherUser.username}", style = MaterialTheme.typography.bodyMedium)
                        }
                        TextButton(onClick = { onDecline(row.contact.id) }) { Text("Decline") }
                        Button(onClick = { onAccept(row.contact.id) }) { Text("Accept") }
                    }
                }
            }
            if (outgoing.isNotEmpty()) {
                item { SectionHeader("Sent requests") }
                items(outgoing, key = { it.contact.id }) { row ->
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        AsyncImage(model = row.otherUser.avatarUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                        Spacer(Modifier.width(12.dp))
                        Text(row.otherUser.displayName ?: "@${row.otherUser.username}", modifier = Modifier.weight(1f))
                        Text("Pending", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            item { SectionHeader("Your contacts") }
            if (accepted.isEmpty()) {
                item { Text("No contacts yet.", modifier = Modifier.padding(16.dp)) }
            }
            items(accepted, key = { it.contact.id }) { row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AsyncImage(model = row.otherUser.avatarUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(row.otherUser.displayName ?: "@${row.otherUser.username}")
                        Text("@${row.otherUser.username}", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
    )
}
