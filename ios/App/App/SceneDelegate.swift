import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Moat's own controller, because it is what registers Moat's plugins.
        // Capacitor's plain one leaves them unregistered and the web layer is
        // told they are not implemented.
        let controller = MoatViewController()
        window?.rootViewController = controller
        window?.makeKeyAndVisible()

        // Swiping from the left edge goes back, as it does everywhere else on
        // iOS. The web view exists once the window has loaded the controller.
        controller.webView?.allowsBackForwardNavigationGestures = true

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
