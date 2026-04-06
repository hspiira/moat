package ug.co.moat.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class MoatNotificationListenerService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return
        val settings = CapturePayloadStore.readSettings(applicationContext)
        if (!settings.notificationCaptureEnabled || !settings.allowedNotificationPackages.contains(packageName)) {
            return
        }

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString()?.trim()
        val text = extras.getCharSequence("android.text")?.toString()?.trim().orEmpty()
        if (text.isBlank()) {
            return
        }

        CapturePayloadStore.enqueue(
            applicationContext,
            MoatCapturePayload(
                channel = "notification",
                source = "notification",
                rawContent = text,
                sourceTitle = title,
                sourceApp = packageName,
                occurredAt = java.time.Instant.ofEpochMilli(sbn.postTime).toString(),
            ),
        )
    }
}
