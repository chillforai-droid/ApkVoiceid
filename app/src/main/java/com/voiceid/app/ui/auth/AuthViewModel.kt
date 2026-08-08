package com.voiceid.app.ui.auth

import android.app.Activity
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.voiceid.app.BuildConfig
import com.voiceid.app.data.model.Profile
import com.voiceid.app.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.UUID

private const val TAG = "VoiceID/GoogleAuth"

sealed class AuthUiState {
    /** Cold-start only: session restoration (awaitSessionResolved) is still in flight. */
    object CheckingSession : AuthUiState()
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Error(val message: String) : AuthUiState()
    object AwaitingOnboarding : AuthUiState()
    object Ready : AuthUiState()
}

class AuthViewModel : ViewModel() {

    private val authRepository = AppContainer.authRepository

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.CheckingSession)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _ownProfile = MutableStateFlow<Profile?>(null)
    val ownProfile: StateFlow<Profile?> = _ownProfile.asStateFlow()

    /** Native Google sign-in via Credential Manager (BACKEND_README §2.1 / AI_HANDOFF §6.1). */
    fun signInWithGoogle(activity: Activity) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading

            // ---- RUNTIME CONFIG DIAGNOSTIC (items 1-7, printed verbatim, no inference) ----
            val maskedClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID.let { id ->
                if (id.length <= 16) id else "${id.take(8)}...MASKED...${id.takeLast(8)}"
            }
            val filterByAuthorizedAccounts = false // literal value passed below; kept as a
            // named val so this log line can never drift from the actual call.
            // Note: "applicationId" (the Gradle build-time value) has no independent runtime
            // API — the only place it's observable inside a running app IS
            // BuildConfig.APPLICATION_ID and context.packageName, both generated/set from it
            // at build time. So items 1-3 below are three separate reads that should all
            // agree; printing all three (rather than assuming BuildConfig.APPLICATION_ID
            // alone is proof) is what catches a mismatch if e.g. a manifest merge, a product
            // flavor, or a manual manifest package override ever made them diverge.
            Log.i(TAG, "GOOGLE_SIGNIN_CONFIG " +
                "[1] applicationId(==BuildConfig.APPLICATION_ID, no separate runtime API exists)=${BuildConfig.APPLICATION_ID} " +
                "| [2] packageName(runtime, PackageManager/Context)=${activity.packageName} " +
                "| [3] BuildConfig.APPLICATION_ID=${BuildConfig.APPLICATION_ID} " +
                "| [4] GOOGLE_WEB_CLIENT_ID(masked)=$maskedClientId " +
                "| [5] credentialManagerRequest=GetCredentialRequest[GetGoogleIdOption] " +
                "(native Google ID token / One Tap-style request — NOT the legacy " +
                "Google Sign-In SDK, NOT a redirect-based OAuth flow) " +
                "| [6] serverClientId(passed to GoogleIdOption.Builder.setServerClientId)=$maskedClientId " +
                "| [7] filterByAuthorizedAccounts=$filterByAuthorizedAccounts")
            // ---------------------------------------------------------------------------

            // Fail fast and LOUD if the client ID was never configured — this is the #1 cause
            // of a silent "loading then back to welcome" with no error, because Credential
            // Manager will simply report NoCredentialException below instead of anything
            // that names the real problem.
            if (BuildConfig.GOOGLE_WEB_CLIENT_ID.isBlank() ||
                BuildConfig.GOOGLE_WEB_CLIENT_ID.startsWith("YOUR_")
            ) {
                val msg = "GOOGLE_WEB_CLIENT_ID is not configured (still a placeholder: " +
                    "'${BuildConfig.GOOGLE_WEB_CLIENT_ID}'). Set GOOGLE_WEB_CLIENT_ID in " +
                    "local.properties to the OAuth 2.0 *Web application* client ID from the " +
                    "same Google Cloud project as Supabase's Google provider."
                Log.e(TAG, "STEP 1 FAILED (config): $msg")
                _uiState.value = AuthUiState.Error(msg)
                return@launch
            }

            val rawNonce = UUID.randomUUID().toString()
            val hashedNonce = MessageDigest.getInstance("SHA-256")
                .digest(rawNonce.toByteArray())
                .joinToString("") { "%02x".format(it) }
            Log.d(TAG, "STEP 1: Built Google ID token request. serverClientId(last12)=" +
                "...${BuildConfig.GOOGLE_WEB_CLIENT_ID.takeLast(12)}")

            val googleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(filterByAuthorizedAccounts)
                .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .setNonce(hashedNonce)
                .build()

            val request = GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

            // STEP 2 + 3: Launch the Credential Manager UI (account chooser) and retrieve
            // whatever credential the user/OS returns.
            val result = try {
                Log.d(TAG, "STEP 2: Calling CredentialManager.getCredential() — account picker should appear now.")
                val credentialManager = CredentialManager.create(activity)
                credentialManager.getCredential(activity, request)
            } catch (e: GetCredentialCancellationException) {
                // User dismissed the account picker. Not an error worth alarming over, but it
                // must still be visible — this is one of the ways the flow can look "silent".
                Log.w(TAG, "STEP 2/3: User cancelled the Google account picker.", e)
                _uiState.value = AuthUiState.Idle
                return@launch
            } catch (e: NoCredentialException) {
                // Most common real-world cause: no Google account on device, OR the Android
                // OAuth client (package name + SHA-1) isn't registered in Google Cloud Console
                // for this app, so Play Services refuses to return any credential.
                val msg = "No Google credential available (NoCredentialException). Check: " +
                    "(1) a Google account is signed in on this device, and " +
                    "(2) an Android OAuth client for package '${activity.packageName}' with " +
                    "this build's SHA-1 fingerprint exists in Google Cloud Console."
                Log.e(TAG, "STEP 2/3 FAILED: $msg", e)
                _uiState.value = AuthUiState.Error(msg)
                return@launch
            } catch (e: GetCredentialException) {
                Log.e(TAG, "STEP 2/3 FAILED: GetCredentialException type=${e.type}", e)
                _uiState.value = AuthUiState.Error("Google account selection failed: ${e.type} — ${e.message}")
                return@launch
            } catch (e: Exception) {
                Log.e(TAG, "STEP 2/3 FAILED: unexpected exception during getCredential()", e)
                _uiState.value = AuthUiState.Error(e.message ?: "Google account selection failed")
                return@launch
            }
            Log.d(TAG, "STEP 3: Credential retrieved, type=${result.credential.type}")

            val credential = result.credential
            if (credential !is CustomCredential ||
                credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                Log.e(TAG, "STEP 4 FAILED: Unexpected credential type: ${credential.type}")
                _uiState.value = AuthUiState.Error("Unexpected credential type: ${credential.type}")
                return@launch
            }

            // STEP 4 + 5: Parse the Google ID token out of the credential payload.
            val googleIdTokenCredential = try {
                GoogleIdTokenCredential.createFrom(credential.data)
            } catch (e: GoogleIdTokenParsingException) {
                Log.e(TAG, "STEP 4/5 FAILED: Could not parse Google ID token credential.", e)
                _uiState.value = AuthUiState.Error("Google sign-in failed: could not parse ID token (${e.message})")
                return@launch
            }
            Log.d(TAG, "STEP 5: Parsed Google ID token for ${googleIdTokenCredential.id}. " +
                "idToken length=${googleIdTokenCredential.idToken.length}")

            // STEP 6 + 7: Exchange the Google ID token for a Supabase session.
            try {
                Log.d(TAG, "STEP 6: Calling Supabase signInWith(IDToken)...")
                authRepository.signInWithGoogleIdToken(googleIdTokenCredential.idToken, rawNonce)
                Log.d(TAG, "STEP 7: Supabase session created. userId=${authRepository.currentUserId()}")
            } catch (e: Exception) {
                // Deliberately not narrowed to one Supabase exception type — the supabase-kt
                // auth call can surface as a generic RestException/AuthRestException/IOException
                // depending on failure point (network vs 4xx from GoTrue), and every one of
                // them must be logged with its real stacktrace and shown to the user, not
                // caught silently.
                val diagnosis = when {
                    e.message?.contains("audience", ignoreCase = true) == true ->
                        " (Likely cause: Supabase Google provider's 'Authorized Client IDs' does " +
                            "not include this app's GOOGLE_WEB_CLIENT_ID.)"
                    e.message?.contains("nonce", ignoreCase = true) == true ->
                        " (Likely cause: nonce mismatch between the Credential Manager request and " +
                            "the Supabase sign-in call.)"
                    e.message?.contains("provider is not enabled", ignoreCase = true) == true ->
                        " (Likely cause: Google provider is disabled in Supabase Auth settings.)"
                    else -> ""
                }
                Log.e(TAG, "STEP 6/7 FAILED: Supabase signInWith(IDToken) threw.$diagnosis", e)
                _uiState.value = AuthUiState.Error("Supabase sign-in failed: ${e.message}$diagnosis")
                return@launch
            }

            // STEP 8 + 9 + 10: Session persistence, sessionStatus/auth-state update, and
            // navigation are handled by afterSignIn() -> _uiState -> AuthNavGraph's
            // LaunchedEffect(uiState), same path Email login already uses successfully.
            try {
                Log.d(TAG, "STEP 8/9: Checking session persistence + fetching profile for onboarding gate.")
                afterSignIn()
                Log.d(TAG, "STEP 10: uiState now ${_uiState.value} — navigation will follow from this.")
            } catch (e: Exception) {
                Log.e(TAG, "STEP 8/9 FAILED: session was created but post-auth profile check threw.", e)
                _uiState.value = AuthUiState.Error("Signed in, but failed to load your profile: ${e.message}")
            }
        }
    }

    fun signUp(email: String, password: String, fullName: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                authRepository.signUp(email, password, fullName)
                afterSignIn()
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Sign up failed")
            }
        }
    }

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                authRepository.signInWithPassword(email, password)
                afterSignIn()
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Invalid email or password")
            }
        }
    }

    fun sendPasswordReset(email: String, onDone: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                authRepository.sendPasswordResetEmail(email)
                _uiState.value = AuthUiState.Idle
                onDone()
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Could not send reset email")
            }
        }
    }

    fun claimUsername(username: String, displayName: String?) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                authRepository.claimUsername(username, displayName)
                _ownProfile.value = authRepository.fetchOwnProfile()
                _uiState.value = AuthUiState.Ready
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(e.message ?: "Could not claim username")
            }
        }
    }

    /**
     * Post-auth onboarding gate check — API_REFERENCE.md §2 / BACKEND_README.md §2.3.
     *
     * Root-cause fix: previously this called fetchOwnProfile() (which internally reads
     * currentUserId()) immediately after signUp()/signIn() returned. That read can race
     * supabase-kt's internal session-import pipeline (see AuthRepository.awaitAuthenticatedSession
     * for the full explanation), which reads as `profile == null` — indistinguishable from
     * "genuinely authenticated, but no profile row yet" — and incorrectly routed the user to
     * AwaitingOnboarding without a real session. The subsequent claimUsername() call would
     * then correctly, but confusingly, fail with "Not authenticated". Waiting for the
     * reactive sessionStatus to actually reach Authenticated first closes that race.
     */
    private suspend fun afterSignIn() {
        val authenticated = authRepository.awaitAuthenticatedSession()
        if (!authenticated) {
            Log.e(TAG, "afterSignIn: sessionStatus never reached Authenticated after sign-in/up.")
            _uiState.value = AuthUiState.Error(
                "Sign-in succeeded but your session didn't activate. Please try again."
            )
            return
        }
        val profile = authRepository.fetchOwnProfile()
        Log.d(TAG, "afterSignIn: fetchOwnProfile() -> ${if (profile == null) "null (needs onboarding)" else "username=${profile.username}"}")
        _ownProfile.value = profile
        _uiState.value = if (profile == null || profile.username.isNullOrBlank()) {
            AuthUiState.AwaitingOnboarding
        } else {
            AuthUiState.Ready
        }
    }

    /**
     * Session restoration on app launch. Root-cause fix: previously read currentUserId()
     * synchronously, which can race the Auth plugin's own async load-from-storage job that
     * starts when install(Auth) runs (SupabaseModule) — on a cold start this could read
     * null before a real persisted session had finished loading, incorrectly showing the
     * Welcome screen to an already-registered user. awaitSessionResolved() waits for that
     * restore job to finish (Initializing -> something else) before we decide.
     */
    fun checkExistingSession() {
        viewModelScope.launch {
            authRepository.awaitSessionResolved()
            if (authRepository.currentUserId() != null) {
                afterSignIn()
            } else {
                _uiState.value = AuthUiState.Idle
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            authRepository.signOut()
            _ownProfile.value = null
            _uiState.value = AuthUiState.Idle
        }
    }
}
