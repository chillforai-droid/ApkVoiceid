package com.voiceid.app.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun WelcomeScreen(
    onContinueWithGoogle: () -> Unit,
    onContinueWithEmail: () -> Unit,
    isLoading: Boolean,
    errorMessage: String? = null
) {
    Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(96.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Filled.Mic,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            Text("VoiceID", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                "Phone-number-free messaging and calls.\nJust your @username.",
                style = MaterialTheme.typography.bodyMedium,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(Modifier.height(40.dp))
            Button(
                onClick = onContinueWithGoogle,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("Continue with Google")
                }
            }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = onContinueWithEmail,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text("Continue with Email")
            }
            if (errorMessage != null) {
                Spacer(Modifier.height(16.dp))
                Text(
                    errorMessage,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun LoginScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSignIn: (email: String, password: String) -> Unit,
    onForgotPassword: () -> Unit,
    onGoToSignUp: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Welcome back", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        if (errorMessage != null) {
            Spacer(Modifier.height(8.dp))
            Text(errorMessage, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onForgotPassword, modifier = Modifier.align(Alignment.End)) {
            Text("Forgot password?")
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSignIn(email.trim(), password) },
            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text("Sign in")
        }
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
            Text("Don't have an account? ")
            Text(
                "Sign up",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onGoToSignUp)
            )
        }
    }
}

@Composable
fun SignUpScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSignUp: (name: String, email: String, password: String) -> Unit,
    onGoToLogin: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var acceptedTerms by remember { mutableStateOf(false) }

    val passwordsMatch = password == confirmPassword
    val canSubmit = name.trim().length >= 2 && email.contains("@") &&
        password.length >= 8 && passwordsMatch && acceptedTerms

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Create your VoiceID", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full name") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = email, onValueChange = { email = it }, label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it }, label = { Text("Password (min 8 characters)") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = confirmPassword, onValueChange = { confirmPassword = it }, label = { Text("Confirm password") },
            visualTransformation = PasswordVisualTransformation(),
            isError = confirmPassword.isNotEmpty() && !passwordsMatch,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = acceptedTerms, onCheckedChange = { acceptedTerms = it })
            Text("I agree to the Terms of Service and Privacy Policy", style = MaterialTheme.typography.bodyMedium)
        }
        if (errorMessage != null) {
            Spacer(Modifier.height(8.dp))
            Text(errorMessage, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSignUp(name.trim(), email.trim(), password) },
            enabled = !isLoading && canSubmit,
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Create account")
        }
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
            Text("Already have an account? ")
            Text(
                "Sign in",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onGoToLogin)
            )
        }
    }
}

@Composable
fun ForgotPasswordScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onSendReset: (email: String) -> Unit,
    onBack: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var sent by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Reset your password", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("We'll email you a link to reset your password.", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(24.dp))
        if (sent) {
            Text("Check your email for a reset link.", color = MaterialTheme.colorScheme.primary)
        } else {
            OutlinedTextField(
                value = email, onValueChange = { email = it }, label = { Text("Email") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth()
            )
            if (errorMessage != null) {
                Spacer(Modifier.height(8.dp))
                Text(errorMessage, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { onSendReset(email.trim()); sent = true },
                enabled = !isLoading && email.contains("@"),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                if (isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Send reset link")
            }
        }
        Spacer(Modifier.height(16.dp))
        TextButton(onClick = onBack) { Text("Back to sign in") }
    }
}

@Composable
fun ChooseUsernameScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onClaim: (username: String, displayName: String) -> Unit
) {
    var username by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    val normalized = username.lowercase().filter { it.isLetterOrDigit() || it == '_' }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Claim your VoiceID", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("This is permanent and unique — choose carefully.", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = displayName, onValueChange = { displayName = it },
            label = { Text("Display name") }, modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("@username") },
            prefix = { Text("@") },
            supportingText = { Text("At least 3 characters, letters/numbers/underscore") },
            modifier = Modifier.fillMaxWidth()
        )
        if (errorMessage != null) {
            Spacer(Modifier.height(8.dp))
            Text(errorMessage, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onClaim(normalized, displayName.ifBlank { normalized }) },
            enabled = !isLoading && normalized.length >= 3,
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isLoading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Claim @$normalized")
        }
    }
}
