package ug.co.moat.app

import android.content.Context
import android.webkit.JavascriptInterface

class MoatHostBridge(
    private val context: Context,
) {
    @JavascriptInterface
    fun updateCaptureSettings(settingsJson: String) {
        CapturePayloadStore.writeSettings(context, settingsJson)
    }
}
