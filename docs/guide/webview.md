# In a WebView

route-stack is built for web apps shown in a native app's WebView. The web side needs no extra code; the app needs a few settings.

## iOS: turn off WebKit's swipe

`WKWebView` has its own back swipe, which navigates the WebView's history with snapshots. Turn it off, so the stack's swipe is the only one.

::: code-group

```tsx [React Native]
<WebView
  source={{ uri }}
  allowsBackForwardNavigationGestures={false} // the default
/>
```

```swift [Swift]
webView.allowsBackForwardNavigationGestures = false // the default
```

:::

### 120Hz

On ProMotion iPhones, transitions run at 120Hz only if the app allows it. Add to the app's `Info.plist`:

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

With it, push, back and the rest of a swipe after release run at 120Hz. While the finger drags, the slide follows at 60Hz: WebKit runs page frames at 60Hz.

## Android: send back to the page

Android's back button and back gesture belong to the app. Send them to the page as a history back while the page can go back, and let the app handle them otherwise.

::: code-group

```tsx [React Native]
const web = useRef<WebView>(null);
const canGoBack = useRef(false);

useEffect(() => {
  const sub = BackHandler.addEventListener("hardwareBackPress", () => {
    if (!canGoBack.current) return false; // the app's: close, exit…
    web.current?.goBack();
    return true;
  });
  return () => sub.remove();
}, []);

<WebView
  ref={web}
  source={{ uri }}
  onNavigationStateChange={(state) => {
    canGoBack.current = state.canGoBack;
  }}
/>;
```

```kotlin [Kotlin]
onBackPressedDispatcher.addCallback(this) {
    if (webView.canGoBack()) webView.goBack()
    else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
}
```

:::

The page receives an ordinary `popstate`, and the stack plays the back transition. The stack's swipe is off on Android by default: see [Swipe Back](./swipe-back#android).
