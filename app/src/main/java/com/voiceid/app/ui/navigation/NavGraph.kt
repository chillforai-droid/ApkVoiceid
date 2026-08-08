package com.voiceid.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.voiceid.app.data.remote.SupabaseModule
import com.voiceid.app.ui.auth.*
import com.voiceid.app.ui.call.ActiveCallScreen
import com.voiceid.app.ui.call.CallViewModel
import com.voiceid.app.ui.call.IncomingCallScreen
import com.voiceid.app.ui.callhistory.CallHistoryScreen
import com.voiceid.app.ui.callhistory.CallHistoryViewModel
import com.voiceid.app.ui.chat.ChatScreen
import com.voiceid.app.ui.chat.ChatViewModel
import com.voiceid.app.ui.common.ContextViewModelFactory
import com.voiceid.app.ui.contacts.ContactsScreen
import com.voiceid.app.ui.contacts.ContactsViewModel
import com.voiceid.app.ui.home.HomeScreen
import com.voiceid.app.ui.home.HomeViewModel
import com.voiceid.app.ui.notifications.NotificationsScreen
import com.voiceid.app.ui.notifications.NotificationsViewModel
import com.voiceid.app.ui.profile.EditProfileScreen
import com.voiceid.app.ui.profile.ProfileScreen
import com.voiceid.app.ui.profile.ProfileViewModel
import com.voiceid.app.ui.search.SearchScreen
import com.voiceid.app.ui.search.SearchViewModel
import com.voiceid.app.ui.settings.SettingsScreen
import com.voiceid.app.ui.settings.SettingsViewModel
import com.voiceid.app.call.CallState

private val bottomNavItems = listOf(
    Triple(Routes.HOME, "Chats", Icons.Filled.ChatBubble),
    Triple(Routes.CONTACTS, "Contacts", Icons.Filled.People),
    Triple(Routes.CALL_HISTORY, "Calls", Icons.Filled.Call),
    Triple(Routes.NOTIFICATIONS, "Alerts", Icons.Filled.Notifications),
    Triple(Routes.PROFILE, "Profile", Icons.Filled.Person)
)

@Composable
fun AuthNavGraph(authViewModel: AuthViewModel, onAuthenticated: () -> Unit) {
    val navController = rememberNavController()
    val uiState by authViewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(uiState) {
        when (uiState) {
            is AuthUiState.AwaitingOnboarding -> navController.navigate(Routes.CHOOSE_USERNAME) { launchSingleTop = true }
            is AuthUiState.Ready -> onAuthenticated()
            else -> {}
        }
    }

    val errorMessage = (uiState as? AuthUiState.Error)?.message
    val isLoading = uiState is AuthUiState.Loading

    NavHost(navController = navController, startDestination = Routes.WELCOME) {
        composable(Routes.WELCOME) {
            WelcomeScreen(
                onContinueWithGoogle = { authViewModel.signInWithGoogle(context as android.app.Activity) },
                onContinueWithEmail = { navController.navigate(Routes.LOGIN) },
                isLoading = isLoading,
                errorMessage = errorMessage
            )
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                isLoading = isLoading,
                errorMessage = errorMessage,
                onSignIn = { email, password -> authViewModel.signIn(email, password) },
                onForgotPassword = { navController.navigate(Routes.FORGOT_PASSWORD) },
                onGoToSignUp = { navController.navigate(Routes.SIGN_UP) }
            )
        }
        composable(Routes.SIGN_UP) {
            SignUpScreen(
                isLoading = isLoading,
                errorMessage = errorMessage,
                onSignUp = { name, email, password -> authViewModel.signUp(email, password, name) },
                onGoToLogin = { navController.popBackStack() }
            )
        }
        composable(Routes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                isLoading = isLoading,
                errorMessage = errorMessage,
                onSendReset = { email -> authViewModel.sendPasswordReset(email) {} },
                onBack = { navController.popBackStack() }
            )
        }
        composable(Routes.CHOOSE_USERNAME) {
            ChooseUsernameScreen(
                isLoading = isLoading,
                errorMessage = errorMessage,
                onClaim = { username, displayName -> authViewModel.claimUsername(username, displayName) }
            )
        }
    }
}

@Composable
fun MainNavGraph(authViewModel: AuthViewModel, onSignedOut: () -> Unit) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val callViewModel: CallViewModel = viewModel(factory = ContextViewModelFactory(context))
    val incomingCall by callViewModel.incomingCall.collectAsState()
    val incomingCallerName by callViewModel.incomingCallerName.collectAsState()
    val callState by callViewModel.callState.collectAsState()

    LaunchedEffect(Unit) { callViewModel.startListeningForIncomingCalls() }

    // Global incoming-call overlay takes priority over whatever screen is showing —
    // mirrors the web app's app-wide IncomingCallModal.
    if (incomingCall != null) {
        IncomingCallScreen(
            callerName = incomingCallerName ?: "Unknown",
            onAccept = { callViewModel.acceptIncomingCall(); navController.navigate(Routes.ACTIVE_CALL) },
            onReject = { callViewModel.rejectIncomingCall() }
        )
        return
    }

    if (callState == CallState.OUTGOING_RINGING || callState == CallState.CONNECTING || callState == CallState.ACTIVE) {
        ActiveCallScreen(
            otherUserName = "Call",
            callState = callState,
            onEndCall = { callViewModel.endCall() },
            onToggleMute = { callViewModel.toggleMute(it) }
        )
        return
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val showBottomBar = bottomNavItems.any { it.first == backStackEntry?.destination?.route }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { (route, label, icon) ->
                        NavigationBarItem(
                            selected = backStackEntry?.destination?.route == route,
                            onClick = { navController.navigate(route) { launchSingleTop = true } },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding)
        ) {
            composable(Routes.HOME) {
                val vm: HomeViewModel = viewModel()
                val conversations by vm.conversations.collectAsState()
                val isLoading by vm.isLoading.collectAsState()
                HomeScreen(
                    conversations = conversations,
                    isLoading = isLoading,
                    onOpenChat = { summary ->
                        navController.navigate(
                            Routes.chat(summary.conversation.id, summary.otherUser.id, summary.otherUser.displayName ?: summary.otherUser.username.orEmpty())
                        )
                    },
                    onSearchClick = { navController.navigate(Routes.SEARCH) }
                )
            }
            composable(Routes.SEARCH) {
                val vm: SearchViewModel = viewModel()
                LaunchedEffect(Unit) { vm.initialize() }
                val results by vm.results.collectAsState()
                val isSearching by vm.isSearching.collectAsState()
                val isLoadingMore by vm.isLoadingMore.collectAsState()
                val errorMessage by vm.errorMessage.collectAsState()
                val recentSearches by vm.recentSearches.collectAsState()
                val pendingRequestIds by vm.pendingRequestIds.collectAsState()
                SearchScreen(
                    results = results,
                    isSearching = isSearching,
                    isLoadingMore = isLoadingMore,
                    errorMessage = errorMessage,
                    recentSearches = recentSearches,
                    pendingRequestIds = pendingRequestIds,
                    onQueryChanged = vm::onQueryChanged,
                    onLoadMore = vm::loadMore,
                    onRetry = vm::retry,
                    onSendRequest = { result -> vm.sendFriendRequest(result.profile.id) }
                )
            }
            composable(Routes.CONTACTS) {
                val vm: ContactsViewModel = viewModel()
                val selfId = SupabaseModule.currentUserId()
                LaunchedEffect(selfId) { selfId?.let { vm.load(it) } }
                val accepted by vm.accepted.collectAsState()
                val incoming by vm.incomingRequests.collectAsState()
                val outgoing by vm.outgoingRequests.collectAsState()
                val isLoading by vm.isLoading.collectAsState()
                ContactsScreen(
                    accepted = accepted, incoming = incoming, outgoing = outgoing, isLoading = isLoading,
                    onAccept = vm::accept, onDecline = vm::decline
                )
            }
            composable(Routes.CALL_HISTORY) {
                val vm: CallHistoryViewModel = viewModel()
                LaunchedEffect(Unit) { vm.load() }
                val rows by vm.rows.collectAsState()
                val isLoading by vm.isLoading.collectAsState()
                CallHistoryScreen(rows = rows, isLoading = isLoading, onCallBack = { profile ->
                    callViewModel.startOutgoingCall(profile.id)
                })
            }
            composable(Routes.NOTIFICATIONS) {
                val vm: NotificationsViewModel = viewModel()
                LaunchedEffect(Unit) { vm.load() }
                val notifications by vm.notifications.collectAsState()
                val isLoading by vm.isLoading.collectAsState()
                NotificationsScreen(
                    notifications = notifications, isLoading = isLoading,
                    onNotificationClick = { vm.markRead(it) },
                    onMarkAllRead = { vm.markAllRead() }
                )
            }
            composable(Routes.PROFILE) {
                val vm: ProfileViewModel = viewModel()
                LaunchedEffect(Unit) { vm.load() }
                val profile by vm.profile.collectAsState()
                ProfileScreen(
                    profile = profile,
                    onEditClick = { navController.navigate(Routes.EDIT_PROFILE) },
                    onSettingsClick = { navController.navigate(Routes.SETTINGS) },
                    onSignOut = { authViewModel.signOut(); onSignedOut() }
                )
            }
            composable(Routes.EDIT_PROFILE) {
                val vm: ProfileViewModel = viewModel()
                LaunchedEffect(Unit) { vm.load() }
                val profile by vm.profile.collectAsState()
                val isSaving by vm.isSaving.collectAsState()
                val error by vm.errorMessage.collectAsState()
                EditProfileScreen(
                    profile = profile, isSaving = isSaving, errorMessage = error,
                    onPickAvatar = { }, pendingAvatarFile = null,
                    onSave = { name, bio ->
                        vm.save(name, bio, null, cloudName = "voiceid") { navController.popBackStack() }
                    },
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Routes.SETTINGS) {
                val vm: SettingsViewModel = viewModel(factory = ContextViewModelFactory(context))
                LaunchedEffect(Unit) { vm.loadPrivacySettings() }
                val themeMode by vm.themeMode.collectAsState()
                val privacy by vm.privacySettings.collectAsState()
                SettingsScreen(
                    themeMode = themeMode, privacySettings = privacy,
                    onThemeModeChange = vm::setThemeMode,
                    onPrivacyChange = vm::updatePrivacySettings
                )
            }
            composable(Routes.CHAT) { backStackEntry ->
                val conversationId = backStackEntry.arguments?.getString("conversationId").orEmpty()
                val otherUserId = backStackEntry.arguments?.getString("otherUserId").orEmpty()
                val otherUserName = backStackEntry.arguments?.getString("otherUserName").orEmpty()
                val vm: ChatViewModel = viewModel(factory = ContextViewModelFactory(context))
                LaunchedEffect(conversationId) { vm.open(conversationId) }
                val messages by vm.messages.collectAsState()
                val isSending by vm.isSending.collectAsState()

                ChatScreen(
                    otherUserName = otherUserName,
                    otherUserOnline = false,
                    messages = messages,
                    selfUserId = vm.selfUserId,
                    isSending = isSending,
                    onSendText = { vm.sendText(conversationId, it) },
                    onSendVoice = { file, duration -> vm.sendVoice(conversationId, file, duration) },
                    onSendImage = { file -> vm.sendImage(conversationId, file) },
                    onMediaRequested = { message, onReady -> vm.mediaFileFor(message, onReady) },
                    onDeleteMessage = { vm.deleteMessage(it) },
                    onCallClick = { callViewModel.startOutgoingCall(otherUserId) },
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
