package com.voiceid.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.*
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.viewmodel.compose.viewModel
import com.voiceid.app.ui.auth.AuthUiState
import com.voiceid.app.ui.auth.AuthViewModel
import com.voiceid.app.ui.navigation.AuthNavGraph
import com.voiceid.app.ui.navigation.MainNavGraph
import com.voiceid.app.ui.theme.ThemeMode
import com.voiceid.app.ui.theme.ThemePreferences
import com.voiceid.app.ui.theme.VoiceIdTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val themePreferences = remember { ThemePreferences(applicationContext) }
            val themeMode by themePreferences.themeMode.collectAsState(initial = ThemeMode.SYSTEM)

            VoiceIdTheme(themeMode = themeMode) {
                VoiceIdApp()
            }
        }
    }
}

@Composable
private fun VoiceIdApp() {
    val authViewModel: AuthViewModel = viewModel()
    val uiState by authViewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { authViewModel.checkExistingSession() }

    // Root-cause fix: this used to seed `isAuthenticated` from a synchronous
    // SupabaseModule.currentUserId() read taken at first composition, before the Auth
    // plugin's async session-restore job (kicked off inside install(Auth) in
    // SupabaseModule) had necessarily finished loading any persisted session from disk.
    // That raced session restoration exactly like the sign-up/claim race documented in
    // AuthRepository.awaitAuthenticatedSession. Driving navigation purely off `uiState` —
    // which checkExistingSession() only advances past CheckingSession once
    // awaitSessionResolved() confirms the restore job is done — removes the race instead
    // of papering over it with a default value.
    when (uiState) {
        is AuthUiState.CheckingSession -> {
            // Session restoration still in flight; the system splash screen is expected to
            // still be showing here. Render nothing until we actually know the answer.
        }
        is AuthUiState.Ready -> {
            MainNavGraph(authViewModel = authViewModel, onSignedOut = {})
        }
        else -> {
            AuthNavGraph(authViewModel = authViewModel, onAuthenticated = {})
        }
    }
}
