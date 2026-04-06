package ug.co.moat.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class MoatCapturePayload(
    val channel: String,
    val source: String,
    val rawContent: String,
    val sourceTitle: String? = null,
    val sourceApp: String? = null,
    val occurredAt: String? = null,
)

data class NativeCaptureSettings(
    val notificationCaptureEnabled: Boolean,
    val allowedNotificationPackages: Set<String>,
)

object CapturePayloadStore {
    private const val PREFERENCES = "moat-native-capture"
    private const val PAYLOAD_QUEUE_KEY = "payload_queue"
    private const val SETTINGS_KEY = "capture_settings"

    private val defaultAllowedPackages = setOf(
        "com.mtn.uganda.momo",
        "com.airtel.ug",
        "ug.co.stanbic.mobile",
        "com.dfcubank.mobile",
        "com.centenary.mobilebanking",
    )

    fun enqueue(context: Context, payload: MoatCapturePayload) {
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val queue = JSONArray(preferences.getString(PAYLOAD_QUEUE_KEY, "[]"))
        queue.put(payload.toJson())
        preferences.edit().putString(PAYLOAD_QUEUE_KEY, queue.toString()).apply()
    }

    fun drain(context: Context): List<MoatCapturePayload> {
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val queue = JSONArray(preferences.getString(PAYLOAD_QUEUE_KEY, "[]"))
        val payloads = buildList {
            for (index in 0 until queue.length()) {
                add(queue.getJSONObject(index).toPayload())
            }
        }
        preferences.edit().remove(PAYLOAD_QUEUE_KEY).apply()
        return payloads
    }

    fun readSettings(context: Context): NativeCaptureSettings {
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val raw = preferences.getString(SETTINGS_KEY, null)
        if (raw.isNullOrBlank()) {
            return NativeCaptureSettings(
                notificationCaptureEnabled = false,
                allowedNotificationPackages = defaultAllowedPackages,
            )
        }

        val json = JSONObject(raw)
        val allowed = json.optJSONArray("allowedNotificationPackages")
        val packages = mutableSetOf<String>()
        if (allowed != null) {
            for (index in 0 until allowed.length()) {
                packages.add(allowed.getString(index))
            }
        }

        return NativeCaptureSettings(
            notificationCaptureEnabled = json.optBoolean("notificationCaptureEnabled", false),
            allowedNotificationPackages = if (packages.isEmpty()) defaultAllowedPackages else packages,
        )
    }

    fun writeSettings(context: Context, settingsJson: String) {
        context
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(SETTINGS_KEY, settingsJson)
            .apply()
    }

    private fun MoatCapturePayload.toJson(): JSONObject =
        JSONObject().apply {
            put("channel", channel)
            put("source", source)
            put("rawContent", rawContent)
            put("sourceTitle", sourceTitle ?: JSONObject.NULL)
            put("sourceApp", sourceApp ?: JSONObject.NULL)
            put("occurredAt", occurredAt ?: JSONObject.NULL)
        }

    private fun JSONObject.toPayload(): MoatCapturePayload =
        MoatCapturePayload(
            channel = getString("channel"),
            source = getString("source"),
            rawContent = getString("rawContent"),
            sourceTitle = optString("sourceTitle").ifBlank { null },
            sourceApp = optString("sourceApp").ifBlank { null },
            occurredAt = optString("occurredAt").ifBlank { null },
        )
}
