import Foundation

/// Money messages a Shortcut has handed over, held until the web layer takes them.
///
/// A Shortcut runs whether or not Moat is on screen, and an automation that
/// pulled the app to the foreground on every message would be unusable, so the
/// payload has to outlive the run that produced it. This mirrors what the
/// Android build does with its own capture queue.
///
/// `UserDefaults` is enough here: a handful of short strings, drained on the
/// next launch, and never the record of truth. The ledger itself is the web
/// layer's, and nothing in this queue is read twice.
enum MoatCaptureQueue {
    private static let storageKey = "moat.pendingNativeCaptures"

    /// A runaway automation must not grow this without end. Older entries are
    /// dropped first, because a queue this long already means nobody has opened
    /// the app in a long while and the newest messages are the useful ones.
    private static let limit = 200

    private static let lock = NSLock()

    static func append(message: String, sender: String?, occurredAt: Date = Date()) {
        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }

        var entry: [String: String] = [
            "message": trimmedMessage,
            "occurredAt": iso8601.string(from: occurredAt)
        ]

        let trimmedSender = sender?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmedSender, !trimmedSender.isEmpty {
            entry["sender"] = trimmedSender
        }

        lock.lock()
        defer { lock.unlock() }

        var pending = read()
        pending.append(entry)
        if pending.count > limit {
            pending.removeFirst(pending.count - limit)
        }
        UserDefaults.standard.set(pending, forKey: storageKey)

        // The action runs without bringing the app to the front, so the process
        // that wrote this can be gone moments later. Written out now rather than
        // whenever the system would have got round to it.
        UserDefaults.standard.synchronize()
    }

    /// Hands over everything held and clears it in the same breath, so a payload
    /// cannot be taken twice by two drains racing each other.
    static func drain() -> [[String: String]] {
        lock.lock()
        defer { lock.unlock() }

        let pending = read()
        if !pending.isEmpty {
            UserDefaults.standard.removeObject(forKey: storageKey)
        }
        return pending
    }

    private static func read() -> [[String: String]] {
        UserDefaults.standard.array(forKey: storageKey) as? [[String: String]] ?? []
    }

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
