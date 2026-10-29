# 트러블슈팅 {#troubleshooting}

## iOS Safari: 스와이프 두 개 {#ios-safari-two-swipes}

**증상:** 앱 웹뷰가 아니라 Safari에서 왼쪽 가장자리를 끌면 Safari의 뒤로가기 미리보기가 뜨고, 제스처가 끝날 때 페이지가 튑니다.

**원인:** Safari의 뒤로가기 스와이프는 페이지에서 비활성화할 수 없습니다. 이때 스택의 스와이프도 함께 시작되어 screen을 띄우고 window를 스크롤합니다. 그동안 Safari는 페이지 캡처를 보여 줍니다. 그래서 Safari가 실제 페이지로 돌아오면 화면이 캡처와 다르게 보입니다.

**해결:** Safari에서는 스택의 스와이프를 끄고 제스처는 Safari에 맡깁니다.

```tsx
const inSafari =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) && // iPadOS Safari는 Mac UA를 보냄
  /Safari\//.test(navigator.userAgent) && // WKWebView에는 "Safari/"가 없음
  !matchMedia("(display-mode: standalone)").matches;

<Stack swipe={inSafari ? false : undefined}>
```

iOS의 Chrome과 Firefox도 이 조건에 걸립니다. 두 브라우저에도 같은 스와이프가 있으므로 괜찮습니다. `undefined`를 넘기면 기본값을 쓰므로 Android에서는 계속 꺼져 있습니다.

홈 화면에 추가한 웹앱(`display-mode: standalone`)에는 Safari 스와이프가 없으므로 스택의 스와이프를 켜 둡니다.

## 슬라이드 중 스크롤 요소가 깜빡임 (iOS) {#a-scroller-flashes-during-a-slide-ios}

screen이 움직이는 동안 가로 캐러셀이나 `overflow: auto` 요소가 한 프레임 비어 보입니다. 이럴 때는 overflow 변수를 쓰면 됩니다.

```css
.carousel {
  overflow-x: var(--route-stack-overflow, auto);
}
```

자세한 내용은 [스크롤과 레이어](/ko/guide/scroll-and-layers#horizontal-scrollers-route-stack-overflow)에 있습니다.

## 긴 페이지에서 back이 늦게 시작함 {#back-starts-late-on-a-long-page}

back은 보관해 둔 screen의 레이아웃을 다시 계산한 뒤에야 첫 프레임을 그립니다. 긴 목록에는 `content-visibility: auto`를 쓰는 것을 권합니다. 자세한 내용은 [스크롤과 레이어](/ko/guide/scroll-and-layers#long-lists)에 있습니다.

React Router에서는 back도 돌아갈 screen의 loader를 기다립니다. 데이터 캐싱이나 스트리밍으로 이 시간을 줄일 수 있습니다([더 빠른 내비게이션 경험](/ko/guide/routers#faster-navigation) 참고).

## 스택 위 헤더가 튐 {#a-header-above-the-stack-jumps}

`<Stack>` 위에 일반 문서 흐름으로 놓인 요소는 window와 함께 스크롤됩니다. 그런데 전환 중에는 레이어 뒤에서 window가 움직입니다. 그래서 두 screen의 스크롤 위치가 다르면 헤더가 갑자기 나타나거나 사라집니다. 헤더를 `position: fixed`로 바꾸고 screen에 여백을 주거나 스택 안으로 옮기면 됩니다. 자세한 내용은 [스크롤과 레이어](/ko/guide/scroll-and-layers#outside-the-stack)에 있습니다.

## Screen이 엉뚱한 곳으로 움직이거나 사라짐 {#screens-slide-to-the-wrong-place-or-vanish}

전환하는 동안 두 screen은 `position: fixed` 레이어가 되어 viewport를 기준으로 놓입니다. 그런데 CSS 규칙상 아래 속성이 걸린 요소는 그 안쪽 fixed 요소의 기준(containing block)이 됩니다. 그러면 레이어가 viewport가 아니라 그 요소를 기준으로 놓이고, 그 요소와 함께 스크롤됩니다.

`transform`(`translate`, `scale`, `rotate` 포함), `perspective`, `filter`, `backdrop-filter`, 이 속성들을 지정한 `will-change`, `contain: paint | layout | strict | content`

`<Stack>`의 조상에 이런 속성이 생기는 흔한 경우는 다음과 같습니다.

- 앱 래퍼에 넣은 "GPU 가속" 핵(`transform: translateZ(0)`, `will-change: transform`)
- transform을 남겨 두는 페이지 전환 래퍼(Framer Motion `motion.div`)
- 모달이 열릴 때 뒤 페이지에 거는 `filter: blur()`
- 확대나 기기 미리보기용으로 앱 전체에 거는 `transform: scale()`

개발 환경에서는 첫 전환이 시작될 때 해당 조상과 속성을 콘솔 경고로 알려 줍니다. 그 속성을 지우거나 스택을 그 요소 밖으로 옮기면 됩니다. screen 안쪽 요소나 스택 옆 요소에 거는 transform은 괜찮습니다.

## 전환이 두 번 겹쳐 재생됨 {#two-transitions-play-at-once}

라우터의 View Transition이 켜져 있기 때문입니다. React Router의 `viewTransition`과 TanStack의 `defaultViewTransition`을 꺼야 합니다.

## Next.js: 쿼리만 바뀌면 슬라이드가 없음 {#next-js-a-query-change-does-not-slide}

`/items?id=1`에서 `/items?id=2`로 push해도 같은 screen에 그대로 머뭅니다. `instrumentation-client.ts`가 없을 때 생기는 문제입니다. 개발 모드에서는 콘솔에 경고가 표시됩니다.

```ts
// instrumentation-client.ts
export { onRouterTransitionStart } from "route-stack/next";
```

## Next.js: "Functions cannot be passed directly to Client Components" {#next-js-functions-cannot-be-passed-directly-to-client-components}

서버 컴포넌트(`layout.tsx`)에서 `animate`, `swipe`, `sameScreen`에 함수를 넘기면 생기는 오류입니다. 스택을 클라이언트 컴포넌트로 감싸면 됩니다. 방법은 [라우터](/ko/guide/routers#next-js-app-router)에 있습니다.

## 스택이 하는 일 보기 {#seeing-what-the-stack-does}

디버그 로그를 켜고 이벤트를 확인하면 됩니다. 설정 방법은 [API](/ko/reference/api#debug-log)에 있습니다. `late-scroll`은 슬라이드가 끝났을 때 window가 들어온 screen의 스크롤 위치에 있지 않았다는 뜻입니다. 슬라이드 도중에 다른 무언가가 window를 스크롤한 것입니다.
