# 제약 {#limitations}

## 요구 사항 {#requirements}

- **React 19.2 이상, 19.3 이상 권장.** 스택은 19.2부터 정식인 `<Activity>`로 screen을 보관합니다. React 19.2에는 보관된 screen과 관련된 버그가 두 가지 있고, 둘 다 19.3에서 고쳐졌습니다.
  - screen 안에서 portal로 렌더한 요소가 screen이 숨겨진 뒤에도 페이지에 남습니다([React #35000](https://github.com/facebook/react/issues/35000)). screen에서 `<body>`로 띄운 모달, 토스트, 메뉴를 열어 둔 채 이동하면 다음 screen 위에 그대로 남습니다. 19.2에서는 이동하기 전에 이런 요소를 닫아야 합니다.
  - screen 안에서 렌더한 `<title>`, `<meta>`, `<link>`(React 19가 `<head>`로 올려 주는 요소)가 screen이 숨겨져도 제거되지 않습니다. 그래서 문서 제목이 보관된 screen의 제목으로 보일 수 있습니다. 19.2에서는 이 요소들을 스택 밖에서 설정해야 합니다.
  - 19.2 미만에는 정식 `<Activity>`가 없어서 동작하지 않습니다.
- **라우터 버전.** 어댑터는 React Router 6.30 이상, TanStack Router 1.122 이상(어댑터가 TanStack이 history에 쓰는 `__TSR_key`를 읽음), Next.js 16 이상(Next 15에 들어 있는 React에는 `Activity`가 없음)에서 만들고 확인했습니다. 그보다 낮은 버전은 지원하지 않습니다.
- **브라우저 history.** 해시 라우터(`createHashRouter`, hash history)는 경로를 `#` 뒤에 두기 때문에 스택은 이를 같은 screen으로 봅니다. 메모리 라우터는 `window.history`를 건드리지 않습니다. 그래서 둘 다 동작하지 않습니다.

## 레이아웃 {#layout}

- **`<Stack>`의 조상 요소에 `transform` 같은 속성을 쓰면 안 됩니다.** fixed 레이어가 그 조상을 기준으로 배치됩니다. 해당 속성 목록은 [트러블슈팅](/ko/reference/troubleshooting#screens-slide-to-the-wrong-place-or-vanish)에 있습니다.
- **`<Stack>`은 문서당 하나만 둘 수 있습니다.** 스택을 중첩할 수 없습니다.

## 라우터 {#routers}

- **브라우저 history 하나를 그대로 따릅니다.** 탭마다 따로 쌓는 스택이나 모달 안의 스택은 만들 수 없습니다.
- **`#` 앵커로 쌓인 history 항목에서는 스와이프 백이 되지 않습니다.** `<a href="#comments">`를 누르면 같은 screen 안에서 스크롤만 이동하고 history에는 항목이 하나 쌓입니다. 이 위치에서는 바로 뒤 항목도 같은 screen이라 스와이프가 열리지 않습니다. 뒤로가기 버튼으로 돌아온 뒤에는 스와이프가 됩니다. iOS Safari 26.2 미만에서는 앵커에 다녀온 페이지에서도 스와이프가 열리지 않습니다. 앵커 이동을 history에 남기지 않으려면 `element.scrollIntoView()`를 쓰면 됩니다.
- **라우터의 View Transition은 꺼야 합니다.** React Router는 `viewTransition`, TanStack은 `defaultViewTransition`입니다. 켜 두면 `document.startViewTransition`이 슬라이드 중인 레이어를 캡처합니다.
- **Next.js intercepting route와 parallel route**(`@modal`)는 지원하지 않습니다. 피드에서 사진을 모달로 열면 pathname이 바뀌므로, 스택은 피드와 모달을 포함한 레이아웃 전체를 새 screen으로 다시 렌더해 push합니다. 이를 지원하려면 어댑터가 모달 슬롯과 페이지를 구분해야 하는데, Next는 이 정보를 공개하지 않습니다. 이런 모달은 컴포넌트 상태로 열거나 같은 screen에 머무는 이동으로 열어야 합니다. 예를 들어 `?photo=`를 replace하면 기본 규칙에서 같은 screen입니다([`sameScreen`](/ko/how-it-works/screens-and-history#what-is-a-new-screen) 참고).
- **자체 스택을 가진 라우터**(Ionic `IonRouterOutlet`, 웹의 React Navigation)나 이전 페이지를 붙잡아 두는 페이지 전환(Framer Motion `AnimatePresence`)은 스택과 같은 일을 하므로 충돌합니다.

## 전환 {#transitions}

- **screen 전체 단위로만 전환합니다.** 공유 요소 전환(이미지가 커지면서 다음 페이지로 이동하는 효과)은 지원하지 않습니다.
- **keyframe에는 `transform`과 `opacity`를 쓰는 것을 권합니다.** 다른 속성도 동작하지만 매 프레임 다시 그립니다.
- **iOS에서 손가락으로 드래그할 때는 60Hz입니다.** 재생되는 슬라이드는 앱이 허용하면 120Hz로 동작합니다([웹뷰에서 쓰기](/ko/guide/webview#_120hz)).
- **iOS에서는 드래그가 45%나 55%를 지날 때마다 한 프레임이 빠집니다.** 레이어 뒤의 window를 더 가까운 screen 위치로 옮기는 순간입니다.

## 브라우저 {#browsers}

- **iOS Safari(웹뷰가 아닌 브라우저)에서는 자체 가장자리 스와이프가 스택의 스와이프와 함께 동작합니다.** 자세한 내용은 [트러블슈팅](./troubleshooting#ios-safari-two-swipes)에 있습니다.
- **보관한 screen은 메모리에만 있습니다.** 새로고침하면 처음부터 다시 시작합니다.
- **새로고침하거나 딥링크로 들어온 직후의 첫 screen에는 뒤에 screen이 없습니다.** 스와이프는 동작하지 않고, 뒤로가기 버튼은 동작합니다.
- **선언 없이 JS로 만든 제스처는 스와이프와 함께 움직입니다.** `transform`으로 움직이는 캐러셀이나 드로어에는 `touch-action: pan-y`나 `data-stack-no-swipe`가 필요합니다. 자세한 내용은 [스와이프 백](/ko/guide/swipe-back#js-gestures)에 있습니다.
- **왼쪽에서 오른쪽 방향만 지원합니다.** 오른쪽에서 왼쪽으로 쓰는 문서에서도 스와이프는 왼쪽 가장자리에서 시작해 오른쪽으로 갑니다.

## 스택이 처리하지 않는 것 {#not-handled-by-the-stack}

- 보관된 screen이 다시 보일 때 데이터를 새로고침할지는 앱이 정합니다(다시 보일 때 effect가 다시 실행됩니다).
- 첫 screen에서 Android 뒤로가기를 눌렀을 때의 동작(닫기, 종료)은 앱이 처리합니다.
- 이동할 때 portal(모달, 토스트)을 닫는 일은 앱이 처리합니다.
