# Supabase / Ktor / kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.voiceid.app.**$$serializer { *; }
-keepclassmembers class com.voiceid.app.** { *** Companion; }
-keepclasseswithmembers class com.voiceid.app.** { kotlinx.serialization.KSerializer serializer(...); }

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# OkHttp / Retrofit
-dontwarn okhttp3.**
-dontwarn retrofit2.**
-keepattributes Signature, Exceptions

# Google Sign-In / Credential Manager
-keep class com.google.android.libraries.identity.googleid.** { *; }
-keep class com.google.android.gms.auth.api.identity.** { *; }
