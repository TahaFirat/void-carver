import UIKit
import WebKit
import Capacitor

@objc(GameViewController)
final class GameViewController: CAPBridgeViewController {
    override var prefersStatusBarHidden: Bool {
        return true
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return [.bottom, .top, .left, .right]
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        self.isStatusBarVisible = false

        guard let webView = self.webView else { return }
        let bg = UIColor(red: 4.0 / 255.0, green: 6.0 / 255.0, blue: 14.0 / 255.0, alpha: 1.0)
        webView.isOpaque = true
        webView.backgroundColor = bg
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false

        let sv = webView.scrollView
        sv.backgroundColor = bg
        sv.isScrollEnabled = false
        sv.bounces = false
        sv.alwaysBounceVertical = false
        sv.alwaysBounceHorizontal = false
        sv.delaysContentTouches = false
        sv.canCancelContentTouches = false
        sv.contentInsetAdjustmentBehavior = .never
        sv.panGestureRecognizer.isEnabled = false
        sv.pinchGestureRecognizer?.isEnabled = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GameViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
