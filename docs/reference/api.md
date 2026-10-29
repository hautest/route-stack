# API

## `<Stack>`

```ts
import { Stack } from "route-stack/react-router"; // React Router
import { Stack } from "route-stack/tanstack-router"; // TanStack Router
import { Stack } from "route-stack/next"; // Next.js App Router
import { Stack } from "route-stack"; // any other router: pass `path`
```

| Prop                   | Type                                                   | Default                      |                                                                                                                         |
| ---------------------- | ------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `children`             | `ReactNode`                                            | —                            | What the router renders                                                                                                 |
| `animate`              | `Animate`                                              | `defaultAnimate`             | The transition for each screen change. [Transitions](/guide/transitions)                                                |
| `swipe`                | `SwipeMode \| (from: string, to: string) => SwipeMode` | `"edge"`, `false` on Android | Where a swipe back can start: the edge, anywhere, or nowhere; per back with a function. [Swipe Back](/guide/swipe-back) |
| `sameScreen`           | `SameScreen`                                           | `defaultSameScreen`          | Whether a push or replace stays on the screen shown. [Screens & History](/how-it-works/screens-and-history)             |
| `enableProgressCssVar` | `boolean`                                              | `false`                      | Writes `--route-stack-progress` during slides. [Progress](/guide/progress)                                              |
| `path`                 | `string`                                               | —                            | Core `Stack` only: the rendered path with query. Adapters fill it                                                       |
| `view`                 | `() => View`                                           | `() => "current"`            | Core `Stack` only. [Writing an Adapter](/advanced/writing-an-adapter)                                                   |

One `<Stack>` per document.

## Presets

```ts
import { ios, android, material, defaultAnimate, onAndroid } from "route-stack";
```

| Export           |                                                                   |
| ---------------- | ----------------------------------------------------------------- |
| `ios`            | `Transition`: slide over, old screen 30% left and darkened, 350ms |
| `android`        | `Transition`: Android 14+ activity transition, 450ms              |
| `material`       | `Transition`: Material shared axis X, 300ms                       |
| `defaultAnimate` | `Animate`: `android` on Android, `ios` elsewhere                  |
| `onAndroid()`    | `boolean`: the page runs on Android                               |

## Screens

```ts
import { defaultSameScreen } from "route-stack";
```

| Export              |                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `defaultSameScreen` | `SameScreen`: a push to the same pathname and query (only the `#fragment` changed), a replace to the same pathname |

## Next.js

```ts
import { onRouterTransitionStart } from "route-stack/next";
```

Re-export it from `instrumentation-client.ts`. [Routers](/guide/routers#next-js-app-router)

## Types

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

// from/to: pathname, query and #fragment, as the address bar has them
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

## CSS variables

| Variable                 | Set on                 | When                                                                             |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| `--route-stack-progress` | `<html>`               | During a slide, with `enableProgressCssVar`. `0` to `1`                          |
| `--route-stack-overflow` | The two lifted screens | During a slide: `hidden`. Use as `overflow-x: var(--route-stack-overflow, auto)` |

## Data attributes

| Attribute            | Element                                    |
| -------------------- | ------------------------------------------ |
| `data-stack-root`    | The stack root                             |
| `data-stack-screen`  | Each screen host (the layer a slide moves) |
| `data-stack-content` | Each screen's content (what React hides)   |

Set by the app:

| Attribute             | Element                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `data-stack-no-swipe` | An element whose drags are its own: no swipe starts on it. [Swipe Back](/guide/swipe-back#js-gestures) |

## Debug log

Set a function on `Symbol.for("route-stack.log")` to receive the stack's events (`commit`, `begin`, `release`, `finished`, `settle`, `blocked`, `returned`, `late-scroll`):

```ts
(globalThis as Record<symbol, unknown>)[Symbol.for("route-stack.log")] = (
  event: string,
  data?: object,
) => console.debug("[route-stack]", event, data);
```
