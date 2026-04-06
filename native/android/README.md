# Android host shell

This folder now contains a standard Android WebView shell scaffold for Moat Phase 2.

## What exists here

- `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`: root Gradle configuration
- `app/build.gradle.kts`: Android app module config
- `app/src/main/AndroidManifest.xml`: host activity, share receiver, and notification listener wiring
- `app/src/main/java/ug/co/moat/app/MainActivity.kt`: WebView host for the Moat app
- `app/src/main/java/ug/co/moat/app/ShareReceiverActivity.kt`: receives Android share intents and queues payloads
- `app/src/main/java/ug/co/moat/app/MoatNotificationListenerService.kt`: allowlisted notification listener
- `app/src/main/java/ug/co/moat/app/CapturePayloadStore.kt`: SharedPreferences-backed payload queue and native capture settings
- `app/src/main/java/ug/co/moat/app/MoatCaptureBridge.kt`: JavaScript injection bridge into the web app
- `app/src/main/java/ug/co/moat/app/MoatHostBridge.kt`: JavaScript interface exposed to the web app for settings sync

## What this shell does

1. hosts the web app inside a hardened WebView
2. receives shared text from Android apps and queues it for the web layer
3. listens for allowlisted financial notifications and queues them for review
4. injects pending native capture payloads into `window.moatNativeCapture.ingest(...)`
5. accepts capture settings updates from the web app through `window.moatHostBridge.updateCaptureSettings(...)`

## Current limitation

This is a runnable scaffold, not a built APK inside this workspace. To run it, an Android SDK and local Gradle toolchain are still required. The web-side contract and native project structure are now aligned.

## Default host URL

The Android shell points at `https://moat.localhost` through `BuildConfig.MOAT_WEB_URL`.
Change that in `app/build.gradle.kts` to your deployed or dev host before building.
