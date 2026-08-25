import AppIntents
import Foundation

/// The action Moat offers the Shortcuts app.
///
/// Gated to iOS 16 because App Intents start there while the app still runs on
/// 15. Below that the `moat://capture` url stays the way in, so nothing is lost,
/// only shorter to set up on a newer phone.
///
/// Passing the message here rather than building a url means the message never
/// becomes part of a url, and so never reaches anywhere a url is kept.
@available(iOS 16.0, *)
struct CaptureMoneyMessageIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture money message"

    static var description = IntentDescription(
        "Hands a money message to Moat. It waits in review, and nothing reaches your ledger until you say so."
    )

    /// False so an automation stays out of the way. The message is queued and
    /// collected the next time Moat is opened, which is what makes this usable
    /// on every incoming message rather than only one being waited for.
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Message")
    var message: String

    @Parameter(title: "Sender")
    var sender: String?

    static var parameterSummary: some ParameterSummary {
        Summary("Capture \(\.$message) from \(\.$sender)")
    }

    func perform() async throws -> some IntentResult {
        MoatCaptureQueue.append(message: message, sender: sender)
        return .result()
    }
}

/// Offers the action in the Shortcuts app without anyone having to assemble it
/// first. Held to iOS 17, which is where this form of the shortcut is available;
/// the action itself is still there to add by hand on 16.
@available(iOS 17.0, *)
struct MoatAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CaptureMoneyMessageIntent(),
            phrases: ["Capture a money message in \(.applicationName)"],
            shortTitle: "Capture money message",
            systemImageName: "tray.and.arrow.down"
        )
    }
}
