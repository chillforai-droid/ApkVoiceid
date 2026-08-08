package com.voiceid.app.ui.theme

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "voiceid_settings")
private val THEME_MODE_KEY = stringPreferencesKey("theme_mode")

class ThemePreferences(private val context: Context) {
    val themeMode = context.dataStore.data.map { prefs ->
        ThemeMode.valueOf(prefs[THEME_MODE_KEY] ?: ThemeMode.SYSTEM.name)
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[THEME_MODE_KEY] = mode.name }
    }
}
