# 시작하기 {#getting-started}

## 설치 {#install}

::: code-group

```sh [npm]
npm install route-stack
```

```sh [yarn]
yarn add route-stack
```

```sh [pnpm]
pnpm add route-stack
```

```sh [bun]
bun add route-stack
```

:::

요구 사항:

- React, React DOM **19.2** 이상(`<Activity>`). 19.3 이상을 권장합니다. 19.2에는 보관된 screen과 관련된 버그가 두 가지 있습니다([제약 사항](/ko/reference/limitations#requirements) 참고).
- 지원 라우터 중 하나 또는 브라우저 history를 쓰는 라우터([라우터](./routers) 참고)

## 라우트 감싸기 {#wrap-your-routes}

루트에서 라우터가 렌더하는 영역을 `<Stack>` 하나로 감쌉니다. `<Stack>`은 사용하는 라우터에 맞는 경로에서 import합니다.

::: code-group

```tsx [React Router]
// app/root.tsx, 또는 루트 라우트의 컴포넌트
import { Outlet } from "react-router";
import { Stack } from "route-stack/react-router";

export default function Root() {
  return (
    <Stack>
      <Outlet />
    </Stack>
  );
}
```

```tsx [TanStack Router]
// src/routes/__root.tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Stack } from "route-stack/tanstack-router";

export const Route = createRootRoute({
  component: () => (
    <Stack>
      <Outlet />
    </Stack>
  ),
});
```

```tsx [Next.js App Router]
// app/layout.tsx
import { Stack } from "route-stack/next";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <Stack>{children}</Stack>
      </body>
    </html>
  );
}
```

:::

**Next.js만 해당:** 프로젝트 루트의 `instrumentation-client.ts`에 한 줄을 추가합니다([라우터](./routers#next-js-app-router) 참고).

```ts
// instrumentation-client.ts
export { onRouterTransitionStart } from "route-stack/next";
```

Next.js의 `layout.tsx`는 서버 컴포넌트로 그대로 둬도 됩니다. `<Stack>`은 클라이언트 컴포넌트지만, `children`과 일반 값만 넘기면 서버 컴포넌트에서 렌더할 수 있습니다. 함수를 받는 prop(`animate`, 함수형 `swipe`, `sameScreen`)을 쓸 때만 클라이언트 컴포넌트로 감싸야 합니다([라우터](./routers#next-js-app-router) 참고).

필요한 코드는 이것뿐입니다. 링크, `navigate()`, `router.push()`, 브라우저 뒤로가기 버튼 등 모든 이동이 슬라이드로 전환되고, back하면 떠나기 직전 상태 그대로의 screen으로 돌아갑니다.

## Screen이란 {#what-is-a-screen}

`<Stack>` 안에 넣은 것은 모두 screen입니다. 전환할 때 screen은 통째로 밀려 움직이고, `<Stack>` 밖에 둔 것은 그 자리에 그대로 있습니다.

떠난 screen은 마운트된 채 멈춰 있습니다. 다시 보일 때까지 스토어나 context가 바뀌어도 다시 렌더되지 않습니다. 자세한 내용은 [개요](/ko/how-it-works/overview#the-dom)에 있습니다.

기본 규칙에서는 경로나 쿼리가 바뀌는 push가 새 screen입니다. pathname이 그대로인 replace(검색어 입력, 정렬 변경)와 `#fragment`만 바뀌는 이동은 같은 screen에 머뭅니다. 이 규칙을 바꾸려면 `sameScreen`을 넘기면 됩니다. 다음 예에서는 정렬을 바꾸는 replace가 새 screen이 되어 슬라이드로 들어옵니다.

```tsx
import { defaultSameScreen, type SameScreen } from "route-stack";

const sortOf = (url: string) =>
  new URL(url, "http://_").searchParams.get("sort");

const sameScreen: SameScreen = (from, to, type) =>
  defaultSameScreen(from, to, type) && sortOf(from) === sortOf(to);

// <Stack sameScreen={sameScreen}>
```

자세한 내용은 [Screen과 history](/ko/how-it-works/screens-and-history#what-is-a-new-screen)에 있습니다.

- `<Stack>` **안**에 둔 헤더나 탭바는 iOS 내비게이션 스택처럼 screen마다 함께 슬라이드됩니다.
- `<Stack>` **밖**에 둔 헤더나 탭바는 제자리에 고정되고, 그 아래에서 screen이 슬라이드됩니다([스크롤과 레이어](./scroll-and-layers#outside-the-stack) 참고).

## 기본값 {#defaults}

|                 | iOS, 데스크톱 등 (Android 외)             | Android                                              |
| --------------- | ----------------------------------------- | ---------------------------------------------------- |
| 전환            | `ios`                                     | `android`                                            |
| 스와이프 백     | 가장자리에서만 (`"edge"`)                 | 꺼짐 (`false`, [Android](./swipe-back#android) 참고) |
| 보관하는 screen | 전부. history로 더는 갈 수 없게 될 때까지 | 같음                                                 |
| 스크롤          | screen별로 저장하고 복원합니다            | 같음                                                 |

[`animate`](./transitions), [`swipe`](./swipe-back), 그 밖의 [props](/ko/reference/api)로 기본값을 바꿀 수 있습니다.

## iOS Safari에서 {#in-ios-safari}

Safari 브라우저에서는 자체 가장자리 스와이프가 스택의 스와이프와 함께 동작합니다. 스택의 스와이프는 꺼야 합니다. 방법은 [트러블슈팅](/ko/reference/troubleshooting#ios-safari-two-swipes)에 있습니다.

## 웹뷰에서 {#in-a-webview}

웹뷰를 감싼 앱에서는 두 가지를 설정해야 합니다. iOS에서는 WebKit 자체 스와이프를 끄고, Android에서는 뒤로가기 버튼 입력을 페이지로 전달합니다. 자세한 내용은 [웹뷰에서 쓰기](./webview)에 있습니다.
