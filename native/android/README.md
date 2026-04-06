# Android host shell scaffolding

This folder documents and scaffolds the Android-native side of Moat Phase 2.

## What exists here

- `AndroidManifest.capture.xml`: manifest snippet for share intent and notification listener wiring
- `MoatCaptureBridge.kt`: WebView bridge contract for shared text and notification payloads
- `MoatNotificationListenerService.kt`: notification listener skeleton that forwards allowlisted payloads into the web app

## What is still required

This repo does **not** yet include a full runnable Android project or Capacitor install. The web-side contract is ready, but a native Android shell still needs:

1. a real Android host project or Capacitor wrapper
2. WebView wiring to the built Next.js app
3. notification permission and settings UX
4. package allowlist enforcement on the native side

## Bridge contract

Native code should call:

```js
window.moatNativeCapture.ingest({
  channel: "shared_text" | "notification",
  source: "shared_text" | "notification",
  rawContent: "...",
  sourceTitle: "...",
  sourceApp: "com.example.app",
  occurredAt: "2026-04-06T12:00:00.000Z"
})
```

The web app already registers this bridge globally and routes payloads into the capture inbox.
