module.exports = {
  expo: {
    name: "VoiceID",
    slug: "voiceid-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0F172A"
    },
    assetBundlePatterns: ["**/*"],
    android: {
      package: "com.voiceid.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0F172A"
      },
      permissions: [
        "RECORD_AUDIO",
        "CAMERA",
        "INTERNET",
        "POST_NOTIFICATIONS"
      ]
    },
    extra: {
      // Injected at build time from environment variables (see .env.example
      // and .github/workflows/build-apk.yml). Read at runtime via
      // expo-constants in src/lib/supabase.ts.
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    }
  }
};
