# route-stack

Native app navigation on the web, on the router you already use.

Screens you leave stay alive, push and back slide like native screens, and a finger swipes back with the real previous screen behind it — not a snapshot. Built for web apps in a WebView (WKWebView, Android WebView), with adapters for the Next.js App Router, React Router and TanStack Router.

**[Documentation](https://hautest.github.io/route-stack/)** · [Demo](https://hautest.github.io/route-stack/demo/) · [한국어 문서](https://hautest.github.io/route-stack/ko/)

## Why

- **Screens stay alive.** The screen you left keeps its DOM, state, inputs and scroll. Back shows it at once: no remount, no refetch.
- **Swipe back with a finger.** From the left edge, or from anywhere on the screen. The screen follows the finger and the release decides. Sliders, media, text fields, declared JS gestures and horizontal scrollers keep their own drags.
- **Your router, unchanged.** One wrapper around what the router renders. Links, `navigate()`, `router.push()` and the browser's back button all slide.
- **Interruptions handled.** A navigation during a slide, a redirect, a router blocker asking "Leave this page?": each lands on the right screen.

## Install

```sh
npm install route-stack
```

Requires React 19.2 or later (19.3 recommended). The core `Stack` works with any router that moves with browser history (pass `path`); built-in adapters cover Next.js 16+, React Router 6.30+ and TanStack Router 1.122+.

## Use

Put one `<Stack>` around what your router renders, at the root.

```tsx
// React Router: your root route
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

```tsx
// TanStack Router: src/routes/__root.tsx
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

```tsx
// Next.js App Router: app/layout.tsx (stays a Server Component)
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

```ts
// Next.js: instrumentation-client.ts
export { onRouterTransitionStart } from "route-stack/next";
```

## Options

```tsx
import { defaultAnimate, defaultSameScreen } from "route-stack";

const sortOf = (url: string) => new URL(url, "http://_").searchParams.get("sort");

<Stack
  // The transition per navigation, or false for none (tabs, for example).
  animate={(from, to, direction) => (to.startsWith("/tabs/") ? false : defaultAnimate(from, to, direction))}
  // Where a swipe back starts: "edge" (default; off on Android), "full", false, or per back.
  swipe="full"
  // Whether a push or replace stays on the screen shown (default: a push to the same
  // path and query, or a replace to the same pathname).
  sameScreen={(from, to, type) => defaultSameScreen(from, to, type) && sortOf(from) === sortOf(to)}
>
```

Presets: `ios`, `android` (Android 14 activity transition) and `material`. A transition is keyframes on `transform` and `opacity`: a modal rising from the bottom is a few lines. See the [documentation](https://hautest.github.io/route-stack/) for every prop.

## In a WebView

- **iOS:** leave `allowsBackForwardNavigationGestures` off: the stack's swipe replaces WebKit's snapshot gesture.
- **Android:** send the system back to the page as `history.back()`; the back transition plays.

## Limits

One linear browser history: no per-tab stacks or stacks inside modals. Kept screens live in memory, so a reload starts fresh. While a finger drags, iOS WebKit renders the page at 60Hz. See [Limitations](https://hautest.github.io/route-stack/reference/limitations).

## License

[MIT](https://github.com/hautest/route-stack/blob/main/LICENSE)
