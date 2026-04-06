package ug.co.moat.app

import android.webkit.ValueCallback
import android.webkit.WebView
import org.json.JSONObject

object MoatCaptureBridge {
    fun ingest(webView: WebView, payload: MoatCapturePayload, callback: ((Boolean) -> Unit)? = null) {
        val payloadJson = JSONObject().apply {
            put("channel", payload.channel)
            put("source", payload.source)
            put("rawContent", payload.rawContent)
            put("sourceTitle", payload.sourceTitle ?: JSONObject.NULL)
            put("sourceApp", payload.sourceApp ?: JSONObject.NULL)
            put("occurredAt", payload.occurredAt ?: JSONObject.NULL)
        }

        val script =
            """
            (function() {
              window.__moatPendingCapturePayloads = window.__moatPendingCapturePayloads || [];
              var payload = $payloadJson;
              if (window.moatNativeCapture && typeof window.moatNativeCapture.ingest === "function") {
                window.moatNativeCapture.ingest(payload);
                return true;
              }
              window.__moatPendingCapturePayloads.push(payload);
              return false;
            })();
            """.trimIndent()

        webView.post {
            webView.evaluateJavascript(script, ValueCallback { result ->
                callback?.invoke(result == "true")
            })
        }
    }
}
