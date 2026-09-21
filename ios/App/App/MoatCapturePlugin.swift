import Capacitor
import Foundation

/// Hands the queued Shortcut captures to the web layer.
///
/// One method on purpose: taking and clearing in a single call means a payload
/// cannot be read, then lost to a crash before it was cleared, and then read
/// again as a second copy of the same message.
@objc(MoatCapturePlugin)
public class MoatCapturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MoatCapturePlugin"
    public let jsName = "MoatCapture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise)
    ]

    @objc func takePending(_ call: CAPPluginCall) {
        call.resolve(["payloads": MoatCaptureQueue.drain()])
    }
}
