import Capacitor

/// Hands Moat's own plugins to the bridge.
///
/// Capacitor stopped finding plugins by scanning the runtime, so one that lives
/// in this app rather than in a package is never registered on its own, however
/// correctly it is written. The web layer is simply told the plugin is not
/// implemented, which reads as a missing feature rather than a missing line.
///
/// SceneDelegate builds this instead of Capacitor's own controller, which is
/// the only reason any of it runs: the storyboard is not what creates the root
/// controller, so pointing that at this class alone changed nothing.
class MoatViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MoatCapturePlugin())
    }
}
