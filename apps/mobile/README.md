# apps/mobile

React Native host that opens the route-stack test web apps (`apps/*`) in a WebView for manual QA on iOS/Android.

- Created with `npx @react-native-community/cli@20.2.0 init RouteStackTest --version 0.87.1 --package-name com.routestack.testapps`
- React Native 0.87.1, React 19.2.3, react-native-webview 13.16.0, react-native-safe-area-context 5.10.1, @dr.pogodin/react-native-fs 2.40.3 (log file + settings)
- Bundle id / application id `com.routestack.testapps`, display name "RouteStack Test"
- **Standalone pnpm project**: own `pnpm-lock.yaml` / `pnpm-workspace.yaml` (`nodeLinker: hoisted`), excluded from the root workspace (`!apps/mobile`). Run every command inside `apps/mobile`.
- Metro runs on **8091** (`pnpm start`). iOS: `AppDelegate.swift` sets it (the prebuilt React core ignores `--port`). Android: `reactNativeDevServerPort` in `android/gradle.properties`.

## Screens

1. **List**: host field, the six apps (`next` :3100, `react-router-spa` :3101, `react-router-ssr` :3102, `tanstack-router` :3103, `tanstack-start` :3104, `plain` :3105), free URL field, iOS `allowsBackForwardNavigationGestures` switch (default off), log server URL. Settings persist in `Documents/settings.json` (Android: `files/settings.json`).
2. **WebView**: full screen, native top bar with ✕ (close), ⓘ (session info: OS, UA, `window.navigation`, log path), ↻ (reload). No navigator, so there's no native edge-pop gesture competing with the web's left-edge swipe.

WebView behaviour:
- iOS: `allowsBackForwardNavigationGestures` from the switch, `webviewDebuggingEnabled`, `allowsLinkPreview={false}`, `bounces={false}`. `onContentProcessDidTerminate` → log + `reload()`.
- Android: hardware back → `history.back()` injected if the WebView `canGoBack`, otherwise back to the list. The web apps send nothing. `setSupportMultipleWindows={false}`, cleartext allowed in debug and release (`AndroidManifest.xml`). `onRenderProcessGone` → log + remount at the current URL.
- Every http(s) navigation (including external links and `target=_blank`) stays in the WebView. Other schemes (`tel:`, `mailto:`, `intent:`) are blocked and logged.

## Host

- Default host is baked in from `ipconfig getifaddr en0` (falling back to `en1`) into `src/defaultHost.json` by `pnpm install` / `pnpm start` / `pnpm host`. On the Android emulator the default is `10.0.2.2`.
- Edit it in the app's Host field. The saved value wins over the default. Run `pnpm host` and rebuild to change the baked-in default.
- Android device or emulator with `adb reverse`: set the host to `localhost` and forward each port:
  ```sh
  for p in 8091 3100 3101 3102 3103 3104 3105 4174; do adb reverse tcp:$p tcp:$p; done
  ```
- The web dev servers must listen on the LAN (`0.0.0.0`), not only `localhost`, for devices that use the Mac's IP.

## Logs

An injected script (`src/injected.ts`, `injectedJavaScriptBeforeContentLoaded`) forwards `console.*`, `error` and `unhandledrejection`, plus an `env` line per document (UA, `'navigation' in window`). The host adds a `session` line (OS version, URL, gesture setting) when a WebView opens. Each line is JSON.

- File: `Documents/webview.log` (path shown on the list screen).
  - iOS simulator: `cat "$(xcrun simctl get_app_container booted com.routestack.testapps data)/Documents/webview.log"`
  - iOS device: Files app → On My iPhone → RouteStack Test (file sharing is on).
  - Android: `adb shell run-as com.routestack.testapps cat files/webview.log`
- Mac log server (optional): run `node scripts/log-server.js 4174 webview.log` and set the app's log server field to `http://<host>:4174/`. Empty = off.

iOS 26's WebKit UA is frozen (`iPhone OS 18_7`). Use the `session` line's `os` for the real version.

## Run

```sh
pnpm install
cd ios && bundle install && bundle exec pod install && cd ..
pnpm start                 # Metro on 8091
```

iOS simulator:
```sh
pnpm ios --udid <SIMULATOR_UDID>     # or: pnpm ios --simulator "iPhone 17"
```

iOS device: open `ios/RouteStackTest.xcworkspace` in Xcode, select the RouteStackTest target → Signing & Capabilities → choose your Team (the project ships without `DEVELOPMENT_TEAM`), change the bundle id if your team can't use `com.routestack.testapps`, then run on the device. Debug builds find Metro through the Mac IP the build script writes to `ip.txt`, so the phone and Mac must be on the same network. Allow the Local Network prompt on first launch. For Safari Web Inspector, use Develop → <device> → the page.

Android:
```sh
adb reverse tcp:8091 tcp:8091
pnpm android                                          # debug build + install
# or: cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```
For Chrome DevTools, use `chrome://inspect`.

Release builds embed the JS bundle, so they need no Metro: `cd android && ./gradlew assembleRelease`, or the Release scheme in Xcode.
