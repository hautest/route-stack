# 라우터 {#routers}

어댑터를 붙이면 라우트, loader, 링크는 그대로 쓸 수 있습니다. 어댑터는 라우터에서 두 가지를 읽어 스택에 넘깁니다.

- **[`path`](/ko/advanced/writing-an-adapter#path)**: 라우터가 이번에 렌더한 path입니다. query도 포함합니다. 예: `/products/12?tab=review`
- **[`view`](/ko/advanced/writing-an-adapter#view)**: 링크를 누르면 URL은 바로 바뀌지만 어떤 라우터는 데이터를 다 불러올 때까지 이전 페이지를 계속 그립니다. 이때 스택이 URL만 보고 전환하면 아직 이전 페이지의 내용을 새 screen에 띄우게 됩니다. 그래서 이런 라우터는 이번 렌더가 새 페이지인지 아직 이전 페이지인지도 알려 줘야 합니다. URL이 바뀌자마자 새 페이지를 그리는 라우터에는 필요 없습니다.

  예를 들어 상품 상세 `/products/12`에서 브라우저 뒤로가기를 누르면 URL은 바로 상품 목록 `/products`로 바뀝니다. 그런데 React Router는 목록의 loader가 끝날 때까지 상세 페이지를 계속 그립니다. 그동안 어댑터는 "아직 이전 페이지"라는 뜻으로 `"stale"`을 넘기고 목록을 그린 뒤에야 "새 페이지"라는 뜻으로 `"current"`를 넘깁니다. 스택은 `"current"`를 받은 뒤에 전환합니다.

| 라우터                                 | import                        | 버전   |
| -------------------------------------- | ----------------------------- | ------ |
| React Router                           | `route-stack/react-router`    | 6.30+  |
| TanStack Router / TanStack Start       | `route-stack/tanstack-router` | 1.122+ |
| Next.js App Router                     | `route-stack/next`            | 16+    |
| 그 밖에 브라우저 history를 쓰는 라우터 | `route-stack`                 | —      |

## React Router {#react-router}

```tsx
import { Outlet } from "react-router";
import { Stack } from "route-stack/react-router";

<Stack>
  <Outlet />
</Stack>;
```

- data 모드(`createBrowserRouter`)와 framework 모드에서 SPA, SSR 모두 동작합니다. v6에서는 data 모드만 쓸 수 있습니다. framework 모드는 v7부터 있습니다.
- 링크와 `navigate()`에서 `viewTransition`을 꺼야 합니다. 켜 두면 View Transition이 슬라이드 중인 레이어를 캡처합니다.
- `<ScrollRestoration>`은 그대로 둬도 됩니다. 스택이 그다음에 window 스크롤을 직접 복원합니다.

### 더 빠른 내비게이션 경험 {#faster-navigation}

loader로 이동하면 React Router는 그 페이지의 데이터를 다 받은 뒤에 화면을 그립니다. push든 back이든 같고 스택도 새 페이지가 그려진 다음에 슬라이드합니다. 그래서 데이터를 받는 시간이 그대로 이동을 기다리는 시간이 됩니다.

더 빠른 내비게이션 경험을 원한다면 데이터 캐싱이나 스트리밍을 함께 쓰는 것을 권합니다.

- **데이터 캐싱:** 한 번 받은 데이터를 저장해 두고 다시 쓰면 back이나 이미 가 본 페이지로는 기다리지 않고 바로 이동합니다. TanStack Query의 `ensureQueryData`를 `clientLoader`에서 쓰는 방식이 한 예입니다.
- **스트리밍:** 오래 걸리는 데이터를 `await`하지 않고 promise로 넘기면 screen이 먼저 슬라이드하고 그 데이터는 `<Suspense>` 자리에 나중에 채워집니다. SSR에서도 서버가 페이지를 먼저 보내고 나머지 데이터를 이어서 보냅니다.

## TanStack Router {#tanstack-router}

```tsx
import { Outlet } from "@tanstack/react-router";
import { Stack } from "route-stack/tanstack-router";

<Stack>
  <Outlet />
</Stack>;
```

- TanStack Router와 TanStack Start에서 동작합니다.
- 경로는 outlet이 렌더하는 마지막 match에서 가져옵니다. 그래서 다음 페이지를 로드하는 동안에도 한 screen에 다른 페이지 내용이 섞이지 않습니다.
- 떠나기 전에 확인을 받는 blocker(`useBlocker`)는 스와이프 백을 막습니다. screen은 제자리로 돌아가고, 사용자가 확인하면 별도의 back으로 이동합니다.
- `defaultViewTransition`은 꺼야 합니다.
- 클라이언트에서만 렌더하는 앱은 `scrollRestoration: true`를 그대로 둬도 됩니다. TanStack Start처럼 SSR을 쓰면 `scrollRestoration: () => false`로 바꾸세요. hydration 전에 스크롤해도 TanStack이 hydration 직후 window를 맨 위로 올리기 때문입니다. `false`로는 이 동작이 꺼지지 않고 새로고침할 때 스크롤 위치도 복원되지 않습니다. 이동할 때의 스크롤 복원은 스택이 그대로 합니다.

### 더 빠른 내비게이션 경험 {#tanstack-faster-navigation}

TanStack Router도 loader가 끝난 뒤에 페이지를 그립니다. 그래서 처음 가는 페이지로 이동할 때는 loader가 데이터를 받는 동안 스택도 기다립니다. 다만 TanStack Router는 받은 loader 데이터를 기본으로 캐시합니다. back이나 이미 가 본 페이지로 이동할 때는 캐시된 데이터로 바로 슬라이드하고 새 데이터는 뒤에서 받아 같은 screen 안에서 바꿉니다.

처음 가는 페이지도 바로 반응하게 하려면 다음 방법을 추천합니다.

- **스트리밍:** 오래 걸리는 데이터를 `await`하지 않고 promise로 넘기고 `<Await>`로 받으면 됩니다. screen이 먼저 슬라이드하고 데이터는 나중에 채워집니다.
- **`pendingMs: 0`:** loader가 끝나기 전에 `pendingComponent`가 새 screen으로 바로 슬라이드합니다. 기본값은 1초라서 그동안은 아무 반응이 없습니다.

`defaultPreload: "intent"`는 마우스를 올렸을 때 데이터를 미리 받아 두므로 데스크톱에서 효과가 큽니다. 터치에서는 손가락이 닿는 순간부터 클릭까지의 짧은 시간만 앞당겨집니다.

## Next.js App Router {#next-js-app-router}

```tsx
// app/layout.tsx
import { Stack } from "route-stack/next";

<body>
  <Stack>{children}</Stack>
</body>;
```

```ts
// instrumentation-client.ts, 프로젝트 루트(또는 src/)
export { onRouterTransitionStart } from "route-stack/next";
```

Next는 이동을 history에 기록하기 **전에** 렌더합니다. 그래서 렌더하는 시점에는 `/items?id=1` 다음의 `/items?id=2`가 push인지 replace인지 history로 알 수 없습니다. [`sameScreen`](/ko/how-it-works/screens-and-history#what-is-a-new-screen)이 판단하려면 이 정보가 필요합니다. `onRouterTransitionStart`는 Next가 이 용도로 제공하는 hook입니다. 이동 직전마다 브라우저에서 이동 종류, URL과 함께 호출되고, 어댑터는 history가 갱신될 때까지 그 값을 보관합니다.

- 이 파일이 없으면 쿼리만 바뀌는 이동은 `sameScreen`과 상관없이 같은 screen에 머뭅니다. 개발 모드에서는 어댑터가 콘솔에 경고를 한 번 출력합니다.
- 어댑터는 브라우저에서만 URL을 읽습니다. 그래서 `cacheComponents`를 켜도 루트 레이아웃의 `<Stack>`이 정적 렌더링을 막지 않습니다.
- `animate`, `swipe`, `sameScreen`에 넘기는 함수는 Server Component에서 전달할 수 없습니다. 스택을 Client Component로 감싸야 합니다.

```tsx
// app/app-stack.tsx
"use client";
import { ios } from "route-stack";
import { Stack } from "route-stack/next";

export function AppStack({ children }: { children: React.ReactNode }) {
  return (
    <Stack animate={(from, to) => (to.startsWith("/sheet") ? false : ios)}>
      {children}
    </Stack>
  );
}
```

- intercepting route와 parallel route(`@modal`)는 지원하지 않습니다. 자세한 내용은 [제약](/ko/reference/limitations#routers)에 있습니다.

## 다른 라우터 {#other-routers}

`history.pushState`, `replaceState`, `popstate`로 이동하는 라우터는 코어 `Stack`으로 쓸 수 있습니다. 렌더한 경로를 쿼리와 함께 넘기면 됩니다.

```tsx
import { Stack } from "route-stack";

// 기록하자마자 새 페이지를 그리는 라우터
<Stack path={location.pathname + location.search}>{page}</Stack>;

// 로딩하는 동안 이전 페이지를 그리는 라우터 (`router.isLoading`은 예시용 이름)
<Stack
  path={renderedPath}
  view={() => (router.isLoading ? "stale" : "current")}
>
  {page}
</Stack>;
```

라우터가 history에 기록한 뒤 동기적으로 렌더한다면 이것으로 충분합니다. 반대로 history에 기록하기 전에 렌더하거나, 새 페이지를 로드하는 동안 이전 페이지를 렌더하거나, 확인 창으로 이동을 막는 라우터라면 `view`까지 넘기는 어댑터가 필요합니다. 자세한 내용은 [어댑터 만들기](/ko/advanced/writing-an-adapter)에 있습니다.

해시 라우터와 메모리 라우터에서는 동작하지 않습니다. 자세한 내용은 [제약](/ko/reference/limitations)에 있습니다.
