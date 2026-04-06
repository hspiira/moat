package ug.co.moat.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class MoatNotificationListenerService : NotificationListenerService() {
    private val allowlist = setOf(
        "com.mtn.uganda.momo",
        "com.airtel.ug",
        "ug.co.stanbic.mobile",
        "com.dfcubank.mobile",
        "com.centenary.mobilebanking"
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return
        if (!allowlist.contains(packageName)) return

        val extras = sbn.notification.extras
        val title = extras?.getCharSequence("android.title")?.toString()
        val text = extras?.getCharSequence("android.text")?.toString()?.trim().orEmpty()
        if (text.isBlank()) return

        val payload = MoatCapturePayload(
            channel = "notification",
            source = "notification",
            rawContent = text,
            sourceTitle = title,
            sourceApp = packageName,
            occurredAt = java.time.Instant.ofEpochMilli(sbn.postTime).toString()
        )

        // MainActivity should hand the payload into the active WebView via MoatCaptureBridge.ingest(...)
        NativeCaptureQueue.enqueue(applicationContext, payload)
    }
}

object NativeCaptureQueue {
    fun enqueue(context: android.content.Context, payload: MoatCapturePayload) {
        // Intentionally stubbed. The Android host shell should persist payloads locally until the WebView is ready.
    }
}
