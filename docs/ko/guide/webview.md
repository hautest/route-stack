# 웹뷰에서 쓰기 {#in-a-webview}

route-stack은 네이티브 앱의 웹뷰 안에서 돌아가는 웹앱을 위해 만들었습니다. 웹 쪽에는 코드를 더 넣을 필요가 없고, 앱 쪽에서 몇 가지만 설정하면 됩니다.

## iOS: WebKit 스와이프 끄기 {#ios-turn-off-webkit-s-swipe}

`WKWebView`에는 자체 뒤로가기 스와이프가 있어서, 캡처한 이미지를 보여 주며 웹뷰 history를 이동합니다. 이 기능을 끄고 스택의 스와이프만 남겨야 합니다.

::: code-group

```tsx [React Native]
<WebView
  source={{ uri }}
  allowsBackForwardNavigationGestures={false} // 기본값
/>
```

```swift [Swift]
webView.allowsBackForwardNavigationGestures = false // 기본값
```

:::

### 120Hz {#_120hz}

ProMotion 아이폰에서 전환을 120Hz로 돌리려면 앱에서 허용해 줘야 합니다. 앱의 `Info.plist`에 다음 항목을 추가하면 됩니다.

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

이 설정을 넣으면 push, back, 손을 뗀 뒤의 스와이프 재생이 120Hz로 돕니다. 손가락으로 끄는 동안에는 WebKit이 페이지 프레임을 60Hz로 돌리기 때문에 60Hz로 따라갑니다.

## Android: back을 페이지로 보내기 {#android-send-back-to-the-page}

Android에서는 뒤로가기 버튼과 뒤로가기 제스처를 앱이 받습니다. 페이지에서 뒤로 갈 수 있으면 history back으로 페이지에 넘기고, 그렇지 않으면 앱이 처리하게 하면 됩니다.

::: code-group

```tsx [React Native]
const web = useRef<WebView>(null);
const canGoBack = useRef(false);

useEffect(() => {
  const sub = BackHandler.addEventListener("hardwareBackPress", () => {
    if (!canGoBack.current) return false; // 앱이 처리: 닫기, 종료 등
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

페이지는 일반적인 `popstate`를 받고, 스택이 back 전환을 재생합니다. Android에서는 스택의 스와이프가 기본으로 꺼져 있습니다. 자세한 내용은 [스와이프 백](./swipe-back#android)에 있습니다.
