# API {#api}

## `<Stack>` {#stack}

```ts
import { Stack } from "route-stack/react-router"; // React Router
import { Stack } from "route-stack/tanstack-router"; // TanStack Router
import { Stack } from "route-stack/next"; // Next.js App Router
import { Stack } from "route-stack"; // 그 외 라우터: `path`를 넘김
```

| Prop                   | 타입                                                   | 기본값                      |                                                                                                                                         |
| ---------------------- | ------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `children`             | `ReactNode`                                            | —                           | 라우터가 렌더하는 내용                                                                                                                  |
| `animate`              | `Animate`                                              | `defaultAnimate`            | screen이 바뀔 때마다 적용할 전환. [전환 애니메이션](/ko/guide/transitions)                                                              |
| `swipe`                | `SwipeMode \| (from: string, to: string) => SwipeMode` | `"edge"`, Android는 `false` | 스와이프 백을 시작할 수 있는 곳: 가장자리, 전체 스와이프, 없음. back마다 함수로 정할 수도 있습니다. [스와이프 백](/ko/guide/swipe-back) |
| `sameScreen`           | `SameScreen`                                           | `defaultSameScreen`         | push나 replace 뒤에도 보이는 screen에 머물지 정합니다. [Screen과 history](/ko/how-it-works/screens-and-history)                         |
| `enableProgressCssVar` | `boolean`                                              | `false`                     | 슬라이드 중에 `--route-stack-progress`를 설정합니다. [진행도](/ko/guide/progress)                                                       |
| `path`                 | `string`                                               | —                           | 코어 `Stack` 전용. 렌더한 경로와 쿼리. 어댑터가 채움                                                                                    |
| `view`                 | `() => View`                                           | `() => "current"`           | 코어 `Stack` 전용. [어댑터 만들기](/ko/advanced/writing-an-adapter)                                                                     |

`<Stack>`은 문서당 하나만 둡니다.

## 프리셋 {#presets}

```ts
import { ios, android, material, defaultAnimate, onAndroid } from "route-stack";
```

| Export           |                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `ios`            | `Transition`: 새 screen이 위로 밀려 들어오고 이전 screen은 왼쪽으로 30% 밀리며 어두워짐. 350ms |
| `android`        | `Transition`: Android 14+ 액티비티 전환. 450ms                                                 |
| `material`       | `Transition`: Material shared axis X. 300ms                                                    |
| `defaultAnimate` | `Animate`: Android에서는 `android`, 나머지에서는 `ios`                                         |
| `onAndroid()`    | `boolean`: 페이지가 Android에서 실행 중인지 여부                                               |

## Screen 판정 {#screens}

```ts
import { defaultSameScreen } from "route-stack";
```

| Export              |                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `defaultSameScreen` | `SameScreen`: push는 pathname과 쿼리가 같을 때(`#fragment`만 다를 때), replace는 pathname이 같을 때 같은 screen |

## Next.js {#next-js}

```ts
import { onRouterTransitionStart } from "route-stack/next";
```

`instrumentation-client.ts`에서 다시 export합니다([라우터](/ko/guide/routers#next-js-app-router) 참고).

## 타입 {#types}

```ts
type Direction = "push" | "back" | "replace";

type Animate = (
  from: string,
  to: string,
  direction: Direction,
) => Transition | false;

interface Transition {
  duration: number;
  easing: string;
  enter: Keyframe[];
  leave: Keyframe[];
  shade?: Keyframe[];
  shadow?: string;
  enterOnTop: boolean;
  back?: Pick<Transition, "enter" | "leave" | "shade">;
}

type NavigationType = "push" | "replace" | "traverse";

type SwipeMode = "edge" | "full" | false;

// from/to: 주소창에 보이는 pathname, 쿼리, #fragment
type SameScreen = (
  from: string,
  to: string,
  type: "push" | "replace",
) => boolean;

type View =
  | "current"
  | "stale"
  | "held"
  | { ahead: "push" | "replace"; url: string };

interface StackProps {
  path: string;
  animate?: Animate;
  swipe?: SwipeMode | ((from: string, to: string) => SwipeMode);
  sameScreen?: SameScreen;
  enableProgressCssVar?: boolean;
  children: ReactNode;
}

interface AdapterProps {
  view?: () => View;
}
```

## CSS 변수 {#css-variables}

| 변수                     | 설정 위치      | 시점                                                                                  |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------- |
| `--route-stack-progress` | `<html>`       | `enableProgressCssVar`가 켜져 있을 때 슬라이드 중. 값은 `0`부터 `1`까지               |
| `--route-stack-overflow` | 띄운 두 screen | 슬라이드 중에는 `hidden`. `overflow-x: var(--route-stack-overflow, auto)` 형태로 사용 |

## Data 속성 {#data-attributes}

| 속성                 | 요소                                          |
| -------------------- | --------------------------------------------- |
| `data-stack-root`    | 스택 루트                                     |
| `data-stack-screen`  | 각 screen의 host(슬라이드 때 움직이는 레이어) |
| `data-stack-content` | 각 screen의 내용(React가 숨기는 요소)         |

앱이 다는 속성:

| 속성                  | 요소                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `data-stack-no-swipe` | 드래그를 스스로 처리하는 요소. 그 위에서는 스와이프가 시작되지 않음. [스와이프 백](/ko/guide/swipe-back#js-gestures) |

## 디버그 로그 {#debug-log}

`Symbol.for("route-stack.log")` 키에 함수를 등록하면 그 함수가 스택 이벤트(`commit`, `begin`, `release`, `finished`, `settle`, `blocked`, `returned`, `late-scroll`)를 받습니다.

```ts
(globalThis as Record<symbol, unknown>)[Symbol.for("route-stack.log")] = (
  event: string,
  data?: object,
) => console.debug("[route-stack]", event, data);
```
