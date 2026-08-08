import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.voiceid.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.voiceid.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }

        // Values are read from local.properties / -P Gradle properties / CI secrets.
        // Never commit real secrets — these placeholders let the project build in CI
        // even before real credentials are supplied. Replace via local.properties for a real run.
        val localProperties = Properties()
        val localPropertiesFile = rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localProperties.load(localPropertiesFile.inputStream())
        }
        fun prop(key: String, default: String): String =
            (project.findProperty(key) as String?)
                ?: localProperties.getProperty(key)
                ?: System.getenv(key)
                ?: default

        buildConfigField("String", "SUPABASE_URL", "\"${prop("SUPABASE_URL", "https://YOUR_PROJECT.supabase.co")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${prop("SUPABASE_ANON_KEY", "YOUR_SUPABASE_ANON_KEY")}\"")
        buildConfigField("String", "API_BASE_URL", "\"${prop("API_BASE_URL", "https://voiceid.online")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${prop("GOOGLE_WEB_CLIENT_ID", "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com")}\"")
        manifestPlaceholders["appAuthRedirectScheme"] = "com.voiceid.app"
    }

    signingConfigs {
        // Checked into the repo deliberately — this is a plain debug key (password
        // "android", same convention Android Studio itself uses for its own
        // auto-generated debug.keystore), not a production secret. The only thing that
        // matters is that its SHA-1 stays IDENTICAL across every CI run, which it can't
        // do if we let Gradle auto-generate a fresh one on every fresh runner (root cause
        // of the "different SHA-1 every build" issue — see debug.keystore.README.md).
        getByName("debug") {
            storeFile = file("../debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        create("release") {
            val localProperties = Properties()
            val localPropertiesFile = rootProject.file("local.properties")
            if (localPropertiesFile.exists()) {
                localProperties.load(localPropertiesFile.inputStream())
            }
            val storeFilePath = localProperties.getProperty("RELEASE_STORE_FILE")
            if (storeFilePath != null) {
                storeFile = file(storeFilePath)
                storePassword = localProperties.getProperty("RELEASE_STORE_PASSWORD")
                keyAlias = localProperties.getProperty("RELEASE_KEY_ALIAS")
                keyPassword = localProperties.getProperty("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Fall back to debug signing when no release keystore is configured (e.g. fresh CI checkout),
            // so `assembleRelease` still produces an installable, unsigned-for-store APK artifact.
            signingConfig = if (signingConfigs.getByName("release").storeFile != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/DEPENDENCIES"
            pickFirsts += "META-INF/INDEX.LIST"
            pickFirsts += "META-INF/io.netty.versions.properties"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.add("-opt-in=kotlin.RequiresOptIn")
        freeCompilerArgs.add("-opt-in=androidx.compose.material3.ExperimentalMaterial3Api")
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    // Core / lifecycle
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
    implementation("androidx.activity:activity-compose:1.10.1")

    // Compose / Material 3 (versions governed by the Compose BOM above)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.9.0")

    // Supabase Android/Kotlin Multiplatform SDK
    implementation(platform("io.github.jan-tennert.supabase:bom:3.6.0"))
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.ktor:ktor-client-okhttp:3.3.0")
    implementation("io.ktor:ktor-client-core:3.3.0")

    // Networking for /api/media/* REST endpoints (raw + presigned upload/download)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")

    // Kotlinx
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.0")

    // Google Sign-In (native OAuth flow, per AI_HANDOFF §6.1)
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Media: recording, images
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")
    implementation("io.coil-kt:coil-compose:2.6.0")

    // Native WebRTC
    implementation("io.getstream:stream-webrtc-android:1.1.1")

    // Background work (presence heartbeat fallback, cache pruning)
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // DataStore for theme/prefs
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Splash screen
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Permissions helper
    implementation("com.google.accompanist:accompanist-permissions:0.34.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
