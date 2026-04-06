package ug.co.moat.app

import android.content.Context
import android.webkit.JavascriptInterface

class MoatHostBridge(
    private val context: Context,
) {
    private val storageBridge = MoatStorageBridge(context)

    @JavascriptInterface
    fun updateCaptureSettings(settingsJson: String) {
        CapturePayloadStore.writeSettings(context, settingsJson)
    }

    @JavascriptInterface
    fun getPendingCaptureRouteHint(): String? = CapturePayloadStore.readPendingRouteHint(context)

    @JavascriptInterface
    fun clearPendingCaptureRouteHint() {
        CapturePayloadStore.clearPendingRouteHint(context)
    }

    @JavascriptInterface
    fun isStorageAvailable(): Boolean = storageBridge.isStorageAvailable()

    @JavascriptInterface
    fun executeStorageCommand(commandJson: String): String =
        storageBridge.executeStorageCommand(commandJson)

    @JavascriptInterface
    fun clearStorage(): Boolean = storageBridge.clearStorage()
}
