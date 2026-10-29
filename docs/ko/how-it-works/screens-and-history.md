# Screen과 history {#screens-history}

## 새 screen의 기준 {#what-is-a-new-screen}

history 항목이 현재 항목이 되는 순간, 그 항목이 어떤 screen인지 history만 보고 정합니다.

| 이동                    | 같은 screen인 경우                                 | 그 외            |
| ----------------------- | -------------------------------------------------- | ---------------- |
| push                    | `#`을 뺀 URL이 같음 (`/page` → `/page#section`)    | 새 screen        |
| replace                 | pathname이 같음 (`/search?q=a` → `/search?q=ab`)   | 새 screen        |
| traverse (뒤로, 앞으로) | 전에 본 항목 → 그 항목의 screen                    | push와 같은 기준 |

이것이 기본 규칙인 `defaultSameScreen`입니다. 예를 들면 다음과 같습니다.

- `/items?id=1`에서 `/items?id=2`로 push하면 새 screen이므로 전환이 일어납니다. 뒤로 가면 `id=1` screen이 그대로 돌아옵니다.
- 검색창에 입력하면서 `?q=`를 replace하거나 정렬을 `?sort=`로 replace하면 같은 screen입니다. 다시 마운트되지 않고 입력창 포커스도 유지됩니다.
- 다른 경로로 replace(리다이렉트)하면 새 screen입니다.

push와 replace의 기준은 `sameScreen` prop으로 바꿀 수 있습니다. `sameScreen`은 `from`, `to`, 이동 종류를 받는 함수입니다. `from`과 `to`는 주소창에 보이는 URL에서 origin을 뺀 값입니다. pathname, 쿼리, `#fragment`가 들어 있고 base path도 포함합니다. 처음 보는 항목으로 traverse할 때는 push로 보고 판단합니다. 스택은 렌더하는 경로로도 이 함수를 호출합니다. 이때 경로에는 `#fragment`와 base path가 없고, 이동 종류는 push와 replace를 모두 넣어 봅니다. 그래서 부수 효과가 없는 함수로 작성해야 합니다. 예를 들어 `?sort=`가 바뀔 때 `false`를 반환하면 정렬 변경이 새 screen이 됩니다. 이 screen은 `replace` 방향으로 들어오고, 기본 제공 전환은 이를 push와 같은 슬라이드로 재생합니다. 교체된 screen은 지웁니다([Screen이란](/ko/guide/getting-started#what-is-a-screen) 참고). 반대로 `?tab=`만 바뀔 때 `true`를 반환하면 탭을 push해도 같은 screen에 머뭅니다.

## push, replace, traverse {#push-replace-traverse}

history 이동은 Navigation API의 분류를 따라 세 가지로 나눕니다.

| 종류     | 동작                    | 예                                                                                 |
| -------- | ----------------------- | ---------------------------------------------------------------------------------- |
| push     | 항목 추가               | 링크, `navigate()`, `router.push()`                                                |
| replace  | 현재 항목 교체          | `navigate(…, { replace: true })`, `router.replace()`, 리다이렉트                   |
| traverse | 이미 있는 항목으로 이동 | 뒤로/앞으로 버튼, `history.back()`, `history.go(n)`, 스와이프 백, Android 뒤로가기 |

traverse 자체에는 방향이 없습니다. 그래서 스택은 두 screen이 마지막으로 있던 history 위치를 비교합니다. 도착할 screen이 더 이전(index가 작은 쪽)에 있으면 `back`, 더 이후에 있으면 `push`입니다. 이 값이 `animate`에 넘어가는 `direction`입니다.

## 보관되는 screen {#kept-screens}

현재 항목이거나 그 이전 항목 중 하나라도 어떤 screen을 보여 주고 있으면, 그 screen은 남겨 둡니다.

- B에서 A로 뒤로 가면 전환이 끝날 때 B를 지웁니다. B를 보여 주는 항목이 현재 항목보다 이후에만 있기 때문입니다. 앞으로 가기로 B에 돌아오면 다시 렌더합니다.
- replace로 새 screen이 되면 교체된 screen을 지웁니다.

보관하는 screen 수에는 제한이 없습니다.

## Navigation API와 polyfill {#navigation-api-and-the-fallback}

Navigation API를 쓸 수 있으면 스택은 항목 정보를 Navigation API에서 읽습니다. 쓸 수 없는 환경(Safari 26.2 미만)에서는 `history.state`에 key와 index를 저장합니다.

- 라우터가 쓰는 state에 합쳐 넣으므로 라우터의 필드는 그대로 유지됩니다.
- route-stack이 로드되기 전에 생긴 항목과 `#anchor` 링크로 생긴 항목은 URL로 기억합니다.
- route-stack은 첫 이동 전에 앱과 함께 로드해야 합니다. 그 전에 생긴 항목은 index가 같아서 순서를 알 수 없습니다.

## Next.js의 순서 {#next-js-order}

Next는 이동을 렌더한 뒤에 history를 씁니다([라우터](/ko/guide/routers#next-js-app-router) 참고). 어댑터의 `view()`는 `onRouterTransitionStart`에서 받은 정보로 `{ ahead: "push" }` 또는 `{ ahead: "replace" }`와 이동할 URL을 알려 줍니다. 스택은 history에 항목이 생기기 전에 이 값으로 `sameScreen`을 호출합니다.
