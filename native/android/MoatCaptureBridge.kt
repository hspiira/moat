package ug.co.moat.app

import android.webkit.WebView

data class MoatCapturePayload(
    val channel: String,
    val source: String,
    val rawContent: String,
    val sourceTitle: String? = null,
    val sourceApp: String? = null,
    val occurredAt: String? = null
)

object MoatCaptureBridge {
    fun ingest(webView: WebView, payload: MoatCapturePayload) {
        val escapedContent = payload.rawContent.replace("\\", "\\\\").replace("'", "\\'")
        val escapedTitle = payload.sourceTitle?.replace("\\", "\\\\")?.replace("'", "\\'") ?: ""
        val escapedSourceApp = payload.sourceApp?.replace("\\", "\\\\")?.replace("'", "\\'") ?: ""
        val escapedOccurredAt = payload.occurredAt?.replace("\\", "\\\\")?.replace("'", "\\'") ?: ""

        val script =
            """
            window.moatNativeCapture && window.moatNativeCapture.ingest({
              channel: '${payload.channel}',
              source: '${payload.source}',
              rawContent: '$escapedContent',
              sourceTitle: '$escapedTitle',
              sourceApp: '$escapedSourceApp',
              occurredAt: '$escapedOccurredAt'
            });
            """.trimIndent()

        webView.post {
            webView.evaluateJavascript(script, null)
        }
    }
}
