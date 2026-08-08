package com.voiceid.app.ui.search

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import com.voiceid.app.data.model.Contact
import com.voiceid.app.data.model.FriendStatus
import com.voiceid.app.data.model.Profile
import com.voiceid.app.data.model.SearchResult
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val PAGE_SIZE = 20
private const val DEBOUNCE_MS = 300L
private const val MAX_RECENT_SEARCHES = 5

/**
 * MVVM for the Search screen. Reuses [com.voiceid.app.data.repository.ContactRepository] for
 * both the profile search and the existing sendFriendRequest endpoint, and
 * [com.voiceid.app.data.repository.PresenceRepository] for online/offline status — no new
 * repositories, no backend or schema changes.
 */
class SearchViewModel : ViewModel() {
    private val contactRepository = AppContainer.contactRepository
    private val presenceRepository = AppContainer.presenceRepository

    private val _results = MutableStateFlow<List<SearchResult>>(emptyList())
    val results: StateFlow<List<SearchResult>> = _results.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _recentSearches = MutableStateFlow<List<String>>(emptyList())
    val recentSearches: StateFlow<List<String>> = _recentSearches.asStateFlow()

    /** userIds with an in-flight sendFriendRequest call — disables the button and blocks duplicates. */
    private val _pendingRequestIds = MutableStateFlow<Set<String>>(emptySet())
    val pendingRequestIds: StateFlow<Set<String>> = _pendingRequestIds.asStateFlow()

    private var debounceJob: Job? = null
    private var searchRequestId = 0
    private var currentQuery = ""
    private var offset = 0
    private var hasMore = true
    private var contactsByOtherUserId: Map<String, Contact> = emptyMap()
    private var selfId: String? = null
    private var initialized = false

    /** Loads the self id + the caller's existing contacts once, so results can show
     * Friends/Pending/Add Friend without an extra round trip per keystroke. */
    fun initialize() {
        if (initialized) return
        initialized = true
        selfId = SupabaseModule.currentUserId()
        viewModelScope.launch {
            runCatching { contactRepository.myContacts() }.onSuccess { contacts ->
                val me = selfId
                contactsByOtherUserId = contacts.associateBy { c ->
                    if (c.requesterId == me) c.responderId else c.requesterId
                }
            }
        }
    }

    fun onQueryChanged(rawQuery: String) {
        debounceJob?.cancel()
        currentQuery = rawQuery
        _errorMessage.value = null
        val trimmed = normalize(rawQuery)

        if (trimmed.isBlank()) {
            _results.value = emptyList()
            _isSearching.value = false
            offset = 0
            hasMore = true
            return
        }

        // Debounce so we search only after the user pauses typing, never on every keystroke.
        debounceJob = viewModelScope.launch {
            delay(DEBOUNCE_MS)
            runSearch(trimmed, resetOffset = true)
        }
    }

    fun loadMore() {
        val trimmed = normalize(currentQuery)
        if (trimmed.isBlank() || _isSearching.value || _isLoadingMore.value || !hasMore) return
        viewModelScope.launch {
            _isLoadingMore.value = true
            appendResults(trimmed)
            _isLoadingMore.value = false
        }
    }

    fun retry() {
        val trimmed = normalize(currentQuery)
        if (trimmed.isBlank()) return
        viewModelScope.launch { runSearch(trimmed, resetOffset = offset == 0) }
    }

    fun sendFriendRequest(userId: String) {
        if (userId in _pendingRequestIds.value) return // duplicate-tap guard
        _pendingRequestIds.value = _pendingRequestIds.value + userId
        viewModelScope.launch {
            try {
                contactRepository.sendFriendRequest(userId)
                _results.value = _results.value.map {
                    if (it.profile.id == userId) it.copy(friendStatus = FriendStatus.PENDING) else it
                }
            } catch (e: Exception) {
                _errorMessage.value = "Couldn't send that friend request. Check your connection and try again."
            } finally {
                _pendingRequestIds.value = _pendingRequestIds.value - userId
            }
        }
    }

    private fun normalize(raw: String) = raw.trim().removePrefix("@").trim()

    private suspend fun runSearch(trimmed: String, resetOffset: Boolean) {
        val requestId = ++searchRequestId // invalidates any older in-flight search
        if (resetOffset) offset = 0
        _isSearching.value = true
        _errorMessage.value = null
        try {
            val profiles = contactRepository.searchUsers(trimmed, limit = PAGE_SIZE, offset = offset)
            if (requestId != searchRequestId) return // superseded by a newer query, drop stale result
            _results.value = profiles.filter { it.id != selfId }.map(::toSearchResult)
            hasMore = profiles.size == PAGE_SIZE
            offset = profiles.size
            addRecentSearch(trimmed)
        } catch (e: Exception) {
            if (requestId == searchRequestId) {
                _errorMessage.value = "Couldn't load results. Check your connection and try again."
            }
        } finally {
            if (requestId == searchRequestId) _isSearching.value = false
        }
    }

    private suspend fun appendResults(trimmed: String) {
        try {
            val profiles = contactRepository.searchUsers(trimmed, limit = PAGE_SIZE, offset = offset)
            val existingIds = _results.value.map { it.profile.id }.toSet()
            val appended = profiles.filter { it.id != selfId && it.id !in existingIds }.map(::toSearchResult)
            _results.value = _results.value + appended
            hasMore = profiles.size == PAGE_SIZE
            offset += profiles.size
        } catch (e: Exception) {
            _errorMessage.value = "Couldn't load more results. Check your connection and try again."
        }
    }

    private fun toSearchResult(profile: Profile): SearchResult {
        val contact = contactsByOtherUserId[profile.id]
        val status = when (contact?.status) {
            "accepted" -> FriendStatus.FRIENDS
            "pending" -> FriendStatus.PENDING
            else -> FriendStatus.NONE
        }
        return SearchResult(
            profile = profile,
            friendStatus = status,
            isOnline = presenceRepository.isOnline(profile.id)
        )
    }

    private fun addRecentSearch(trimmed: String) {
        val updated = listOf(trimmed) + _recentSearches.value.filterNot { it.equals(trimmed, ignoreCase = true) }
        _recentSearches.value = updated.take(MAX_RECENT_SEARCHES)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    results: List<SearchResult>,
    isSearching: Boolean,
    isLoadingMore: Boolean,
    errorMessage: String?,
    recentSearches: List<String>,
    pendingRequestIds: Set<String>,
    onQueryChanged: (String) -> Unit,
    onLoadMore: () -> Unit,
    onRetry: () -> Unit,
    onSendRequest: (SearchResult) -> Unit
) {
    var query by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val keyboardController = LocalSoftwareKeyboardController.current

    fun setQuery(value: String) {
        query = value
        onQueryChanged(value)
    }

    // Trigger pagination a few rows before the end, instead of waiting for the exact last pixel.
    LaunchedEffect(listState, results.size) {
        snapshotFlow {
            listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
        }.collect { lastVisibleIndex ->
            if (results.isNotEmpty() && lastVisibleIndex >= results.size - 3) {
                onLoadMore()
            }
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Search") }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = ::setQuery,
                placeholder = { Text("Search by username, @username, or name") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = {
                    AnimatedVisibility(visible = query.isNotEmpty(), enter = fadeIn(), exit = fadeOut()) {
                        IconButton(onClick = { setQuery("") }) {
                            Icon(Icons.Filled.Clear, contentDescription = "Clear search")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(20.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { keyboardController?.hide() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            )

            when {
                query.isBlank() -> EmptySearchState(
                    recentSearches = recentSearches,
                    onRecentSearchClick = { setQuery(it) }
                )
                errorMessage != null && results.isEmpty() && !isSearching ->
                    ErrorState(message = errorMessage, onRetry = onRetry)
                isSearching && results.isEmpty() -> SearchSkeletonList()
                results.isEmpty() -> NoResultsState(query = query)
                else -> LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                    items(results, key = { it.profile.id }) { result ->
                        SearchResultRow(
                            result = result,
                            isRequestPending = result.profile.id in pendingRequestIds,
                            onAddFriend = { onSendRequest(result) }
                        )
                    }
                    if (isLoadingMore) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchResultRow(
    result: SearchResult,
    isRequestPending: Boolean,
    onAddFriend: () -> Unit
) {
    val profile = result.profile
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            AsyncImage(
                model = profile.avatarUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondaryContainer)
            )
            if (result.isOnline) {
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
                profile.displayName ?: profile.username?.let { "@$it" } ?: "Unknown",
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Text(
                profile.username?.let { "@$it" } ?: "",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(8.dp))
        FriendActionControl(
            status = result.friendStatus,
            isLoading = isRequestPending,
            onAddFriend = onAddFriend
        )
    }
}

@Composable
private fun FriendActionControl(status: FriendStatus, isLoading: Boolean, onAddFriend: () -> Unit) {
    when (status) {
        FriendStatus.FRIENDS -> AssistChip(onClick = {}, enabled = false, label = { Text("Friends") })
        FriendStatus.PENDING -> AssistChip(onClick = {}, enabled = false, label = { Text("Pending") })
        FriendStatus.NONE -> {
            if (isLoading) {
                Box(modifier = Modifier.size(width = 96.dp, height = 36.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                }
            } else {
                FilledTonalButton(onClick = onAddFriend, contentPadding = PaddingValues(horizontal = 12.dp)) {
                    Icon(Icons.Filled.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add Friend")
                }
            }
        }
    }
}

@Composable
private fun EmptySearchState(recentSearches: List<String>, onRecentSearchClick: (String) -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        if (recentSearches.isNotEmpty()) {
            Text(
                "Recent searches",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(8.dp))
            recentSearches.forEach { term ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onRecentSearchClick(term) }
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Filled.History,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(term)
                }
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Filled.PersonSearch,
                    contentDescription = null,
                    modifier = Modifier.size(56.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "Find people on VoiceID",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Search by username, @username, or display name.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun NoResultsState(query: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Filled.PersonSearch,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(12.dp))
        Text("No users found", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(
            "Nobody matches \"$query\". Try a different username or name.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Filled.WifiOff,
            contentDescription = null,
            modifier = Modifier.size(56.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(Modifier.height(12.dp))
        Text("Couldn't load results", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(
            message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
private fun SearchSkeletonList() {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(6) { SkeletonRow() }
    }
}

@Composable
private fun SkeletonRow() {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.55f,
        animationSpec = infiniteRepeatable(
            animation = tween(700, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "skeletonAlpha"
    )
    val shimmerColor = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha)

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(shimmerColor))
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Box(modifier = Modifier.fillMaxWidth(0.5f).height(14.dp).clip(RoundedCornerShape(4.dp)).background(shimmerColor))
            Spacer(Modifier.height(6.dp))
            Box(modifier = Modifier.fillMaxWidth(0.3f).height(12.dp).clip(RoundedCornerShape(4.dp)).background(shimmerColor))
        }
        Spacer(Modifier.width(8.dp))
        Box(modifier = Modifier.size(width = 96.dp, height = 32.dp).clip(RoundedCornerShape(8.dp)).background(shimmerColor))
    }
}
