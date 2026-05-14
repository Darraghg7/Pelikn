import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var launchWordOverlayWindow: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.async { [weak self] in
            self?.showLaunchWordOverlay()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication,
                     continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application,
                                                           continue: userActivity,
                                                           restorationHandler: restorationHandler)
    }

    private func showLaunchWordOverlay() {
        guard launchWordOverlayWindow == nil else { return }

        let overlayWindow: UIWindow
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first {
            overlayWindow = UIWindow(windowScene: scene)
        } else {
            overlayWindow = UIWindow(frame: UIScreen.main.bounds)
        }

        overlayWindow.frame = UIScreen.main.bounds
        overlayWindow.windowLevel = .alert + 1
        overlayWindow.backgroundColor = .clear
        overlayWindow.isUserInteractionEnabled = false

        let viewController = UIViewController()
        let overlay = viewController.view!
        overlay.backgroundColor = UIColor(red: 42 / 255, green: 74 / 255, blue: 64 / 255, alpha: 1)

        let word = UILabel()
        word.text = "Pelikn"
        word.textColor = .white
        word.textAlignment = .center
        word.font = .systemFont(ofSize: 48, weight: .bold)
        word.adjustsFontSizeToFitWidth = true
        word.minimumScaleFactor = 0.7
        word.translatesAutoresizingMaskIntoConstraints = false

        overlay.addSubview(word)
        overlayWindow.rootViewController = viewController
        overlayWindow.isHidden = false
        launchWordOverlayWindow = overlayWindow

        NSLayoutConstraint.activate([
            word.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            word.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            word.widthAnchor.constraint(equalTo: overlay.widthAnchor, multiplier: 0.72)
        ])

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.35) { [weak self] in
            UIView.animate(withDuration: 0.12, delay: 0, options: [.curveEaseOut]) {
                self?.launchWordOverlayWindow?.alpha = 0
            } completion: { _ in
                self?.launchWordOverlayWindow?.isHidden = true
                self?.launchWordOverlayWindow = nil
            }
        }
    }
}
