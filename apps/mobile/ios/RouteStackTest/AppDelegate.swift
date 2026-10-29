import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "RouteStackTest",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // The prebuilt React core bakes in Metro port 8081, ignoring `run-ios --port`; this app's Metro
    // runs on 8091. ip.txt holds the Mac's IP on device builds (absent on the simulator).
    let ip = Bundle.main.path(forResource: "ip", ofType: "txt")
      .flatMap { try? String(contentsOfFile: $0, encoding: .utf8) }?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let settings = RCTBundleURLProvider.sharedSettings()
    settings.jsLocation = "\(ip ?? "localhost"):8091"
    return settings.jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
