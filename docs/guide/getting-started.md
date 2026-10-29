# Getting Started

## Install

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

Requirements:

- React and React DOM **19.2** or later (`<Activity>`); 19.3 or later recommended: 19.2 has two bugs with kept screens, see [Limitations](/reference/limitations#requirements).
- One of the supported routers, or any router that writes browser history: see [Routers](./routers).

## Wrap your routes

Put one `<Stack>` around what your router renders, at the root. Import it from the entry for your router.

::: code-group

```tsx [React Router] check
// app/root.tsx, or your root route's component
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

```tsx [TanStack Router] check
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

```tsx [Next.js App Router] check
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

**Next.js only:** add one line to `instrumentation-client.ts` at the project root (see [Routers](./routers#next-js-app-router)):

```ts check
// instrumentation-client.ts
export { onRouterTransitionStart } from "route-stack/next";
```

With Next.js, `layout.tsx` can stay a Server Component: `<Stack>` is a Client Component, and a Server Component can render it with `children` and plain values. Only props that take a function (`animate`, a `swipe` function, `sameScreen`) need a Client Component around the stack: see [Routers](./routers#next-js-app-router).

That is all the code. Links, `navigate()`, `router.push()`, the browser's back button: every navigation now slides, and back returns to the screen as it was.

## What is a screen

Everything inside `<Stack>` is the screen: it slides as one during a transition. Anything outside `<Stack>` stays where it is.

A screen you leave stays mounted but frozen: it does not re-render on store or context updates until it shows again. See [Overview](/how-it-works/overview#the-dom).

By default, a push to another path or query is a new screen. A replace that keeps the pathname (typing a search, a sort) and a change of the `#fragment` only stay on the screen. To change that, pass `sameScreen`. Here a sort that replaces its query is a new screen, which slides in:

```tsx
import { defaultSameScreen, type SameScreen } from "route-stack";

const sortOf = (url: string) =>
  new URL(url, "http://_").searchParams.get("sort");

const sameScreen: SameScreen = (from, to, type) =>
  defaultSameScreen(from, to, type) && sortOf(from) === sortOf(to);

// <Stack sameScreen={sameScreen}>
```

See [Screens & History](/how-it-works/screens-and-history#what-is-a-new-screen).

- A header or tab bar **inside** `<Stack>` slides with each screen, as in an iOS navigation stack.
- A header or tab bar **outside** `<Stack>` stays fixed while screens slide under it. See [Scroll & Layers](./scroll-and-layers#outside-the-stack).

## Defaults

|              | iOS, desktop and others                     | Android                                            |
| ------------ | ------------------------------------------- | -------------------------------------------------- |
| Transition   | `ios`                                       | `android`                                          |
| Swipe back   | From the edge (`"edge"`)                    | Off (`false`; see [Android](./swipe-back#android)) |
| Kept screens | All, until history can no longer reach them | Same                                               |
| Scroll       | Saved and restored per screen               | Same                                               |

Change them with [`animate`](./transitions), [`swipe`](./swipe-back) and the other [props](/reference/api).

## In iOS Safari

Safari's own edge swipe runs alongside the stack's; turn the stack's off there: see [Troubleshooting](/reference/troubleshooting#ios-safari-two-swipes).

## In a WebView

The app around the WebView needs two settings — turn off WebKit's own swipe on iOS, and send Android's back button to the page. See [In a WebView](./webview).
