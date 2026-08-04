import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Same Supabase project as the website. URL/key are injected at build time
// from GitHub Secrets (see .github/workflows/build-apk.yml and app.config.js)
// so no secrets are ever committed to the repo.
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY as environment variables / GitHub Secrets before building.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// CRITICAL for React Native: unlike a browser tab, JS timers pause while the
// app is backgrounded, so Supabase's autoRefreshToken loop silently stops.
// Without this, the access token can expire while the app is in the
// background and every authenticated request (upload, download-auth, etc.)
// comes back 401 until the user manually logs out/in again.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
