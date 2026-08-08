package com.voiceid.app.data.remote

import android.content.Context
import com.voiceid.app.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.storage.Storage
import kotlinx.coroutines.flow.StateFlow

/**
 * Single Supabase client instance for the whole app, wired against the SAME Supabase
 * project the web client uses (SUPABASE_URL / SUPABASE_ANON_KEY — see BACKEND_README.md §1).
 * Never point this at a different backend or bypass RLS from the client.
 */
object SupabaseModule {

    @Volatile
    private var instance: SupabaseClient? = null

    fun client(context: Context? = null): SupabaseClient {
        return instance ?: synchronized(this) {
            instance ?: createSupabaseClient(
                supabaseUrl = BuildConfig.SUPABASE_URL,
                supabaseKey = BuildConfig.SUPABASE_ANON_KEY
            ) {
                install(Auth) {
                    // Native deep-link redirect target registered in AndroidManifest.xml
                    // (scheme "com.voiceid.app", host "auth-callback") — mirrors the web
                    // app's hardcoded https://voiceid.online/auth/callback redirect, per
                    // BACKEND_README.md §2.1 / AI_HANDOFF.md §6.1.
                    scheme = "com.voiceid.app"
                    host = "auth-callback"
                }
                install(Postgrest)
                install(Realtime)
                install(Storage)
            }.also { instance = it }
        }
    }

    fun auth(context: Context? = null) = client(context).auth
    fun postgrest(context: Context? = null) = client(context).postgrest
    fun realtime(context: Context? = null) = client(context).realtime

    fun sessionStatus(): StateFlow<SessionStatus> = client().auth.sessionStatus

    fun currentUserId(): String? = client().auth.currentUserOrNull()?.id

    fun currentAccessToken(): String? = client().auth.currentAccessTokenOrNull()
}
