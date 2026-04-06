package ug.co.moat.app

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    flushPendingPayloads()
                }
            }
            webChromeClient = WebChromeClient()
            addJavascriptInterface(MoatHostBridge(this@MainActivity), "moatHostBridge")
        }

        setContentView(webView)
        webView.loadUrl(BuildConfig.MOAT_WEB_URL)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        flushPendingPayloads()
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") {
            return
        }

        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        val sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
        if (sharedText.isBlank()) {
            return
        }

        CapturePayloadStore.enqueue(
            this,
            MoatCapturePayload(
                channel = "shared_text",
                source = "shared_text",
                rawContent = sharedText,
                sourceTitle = sharedTitle.ifBlank { null },
                occurredAt = java.time.Instant.now().toString(),
            ),
        )
        CapturePayloadStore.writePendingRouteHint(this, "/transactions/review/capture")
        flushPendingPayloads()
    }

    private fun flushPendingPayloads() {
        val payloads = CapturePayloadStore.drain(this)
        if (payloads.isEmpty()) {
            return
        }

        payloads.forEach { payload ->
            MoatCaptureBridge.ingest(webView, payload) { delivered ->
                if (!delivered) {
                    CapturePayloadStore.enqueue(this, payload)
                }
            }
        }
    }
}
