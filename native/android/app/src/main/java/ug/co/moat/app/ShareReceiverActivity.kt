package ug.co.moat.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class ShareReceiverActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        val sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()

        if (intent.action == Intent.ACTION_SEND && intent.type == "text/plain" && sharedText.isNotBlank()) {
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
        }

        startActivity(
            Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            },
        )
        finish()
    }
}
