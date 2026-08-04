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
        "POST_NOTIFICATIONS",
        "READ_MEDIA_IMAGES"
      ]
    },
    plugins: [
      [
        "expo-av",
        {
          microphonePermission: "VoiceID को वॉइस मैसेज रिकॉर्ड करने के लिए माइक्रोफ़ोन एक्सेस चाहिए।"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "VoiceID को फ़ोटो भेजने के लिए आपकी गैलरी एक्सेस चाहिए।"
        }
      ]
    ],
    extra: {
      // Injected at build time from environment variables (see .env.example
      // and .github/workflows/build-apk.yml). Read at runtime via
      // expo-constants in src/lib/supabase.ts and src/lib/api.ts.
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      // Canonical production API origin. For VoiceID use https://www.voiceid.online
      // — the app calls its /api/media/* endpoints for upload/download,
      // same as the website does, since B2 credentials stay server-side.
      apiBaseUrl: process.env.API_BASE_URL
    }
  }
};
