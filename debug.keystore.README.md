# debug.keystore

This file is checked into the repo **on purpose**. It is a plain, non-secret
debug signing key (password `android`, alias `androiddebugkey` — the same
convention Android Studio itself uses for its own auto-generated
`~/.android/debug.keystore`).

## Why it's here

GitHub Actions runners are fresh VMs on every run. Without a checked-in
keystore, Gradle silently auto-generates a brand-new random debug key on
every single CI run whenever `~/.config/.android/debug.keystore` doesn't
already exist — which means the debug APK's signing certificate SHA-1
fingerprint was different every build. Since Google Sign-In (Credential
Manager) validates the calling app against a package-name + SHA-1 pair
registered in Google Cloud Console, an ever-changing SHA-1 made Google
Sign-In permanently unstable for any CI-built APK: whatever SHA-1 you
registered was only ever valid for the one build it came from.

`app/build.gradle.kts` now points the `debug` signingConfig explicitly at
this file (`storeFile = file("../debug.keystore")`), so every debug build —
local or CI — signs with the exact same key, forever.

## SHA-1 fingerprint of this specific keystore

Registered in Google Cloud Console → APIs & Services → Credentials →
"VoiceID Android Debug":

```
C2:D0:28:EB:15:63:BC:C4:57:EE:DE:94:C6:27:62:A3:CB:2D:3A:A9
```

Verify at any time with:
```
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android
```

## Release builds

`local.properties`'s `RELEASE_STORE_FILE`/`RELEASE_STORE_PASSWORD`/etc are
still unset, so the release build type currently falls back to signing with
this same debug keystore too (see the `signingConfig = if (...)` fallback in
`app/build.gradle.kts`). That means, for now, registering the SHA-1 above
under "VoiceID Android Release" in Console as well covers both variants.
Once a real release keystore is added as CI secrets, register *that*
keystore's own SHA-1 under the Release client instead, and this note no
longer applies to Release.
