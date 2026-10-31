# Routers

With an adapter, your routes, loaders and links stay as they are. The adapter reads two things from the router and passes them to the stack:

- **[`path`](/advanced/writing-an-adapter#path)**: the path the router just rendered, with its query. For example, `/products/12?tab=review`.
- **[`view`](/advanced/writing-an-adapter#view)**: a link changes the URL right away, but some routers keep drawing the old page until its data loads. If the stack switched on the URL alone, it would show the old page's content in the new screen. So these routers also tell whether this render is the new page or still the old one. Routers that draw the new page as soon as the URL changes don't need it.

  For example, pressing the browser's back button on a product page `/products/12` changes the URL to the product list `/products` at once, but React Router keeps drawing the product page until the list's loader finishes. Meanwhile the adapter passes `"stale"`, meaning "still the old page", and only after the list is drawn does it pass `"current"`, meaning "the new page". The stack switches once it gets `"current"`.

| Router                                    | Import                        | Version |
| ----------------------------------------- | ----------------------------- | ------- |
| React Router                              | `route-stack/react-router`    | 6.30+   |
| TanStack Router / TanStack Start          | `route-stack/tanstack-router` | 1.122+  |
| Next.js App Router                        | `route-stack/next`            | 16+     |
| Anything else that writes browser history | `route-stack`                 | —       |

## React Router

```tsx
import { Outlet } from "react-router";
import { Stack } from "route-stack/react-router";

<Stack>
  <Outlet />
</Stack>;
```

- Works in data mode (`createBrowserRouter`) and framework mode, SPA and SSR. On v6 only data mode applies; framework mode is v7 and later.
- Turn off `viewTransition` on links and `navigate()`: a View Transition would capture the sliding layers.
- `<ScrollRestoration>` can stay: the stack restores the window scroll itself, after it.

### Faster navigation {#faster-navigation}

When you navigate with loaders, React Router draws a page only after all of its data has arrived — on push and back alike — and the stack slides once the new page is drawn. So the time to get the data is the time every navigation waits.

For a faster navigation experience, add data caching or streaming:

- **Data caching:** keep data you have fetched and reuse it, and back, or a move to a page you have visited, happens without waiting. Using TanStack Query's `ensureQueryData` in a `clientLoader` is one way.
- **Streaming:** pass slow data as a promise instead of awaiting it, and the screen slides first while that data fills its `<Suspense>` fallback later. With SSR, the server also sends the page first and streams the rest of the data after it.

## TanStack Router

```tsx
import { Outlet } from "@tanstack/react-router";
import { Stack } from "route-stack/tanstack-router";

<Stack>
  <Outlet />
</Stack>;
```

- Works with TanStack Router and TanStack Start.
- The path is the one the outlet renders (its last match), so a screen never gets another page's content while the next page loads.
- A blocker (`useBlocker`) that asks before leaving holds a swipe back: the screen slides back to rest, and leaving after the user confirms is a back of its own.
- Turn off `defaultViewTransition`.
- In an app rendered on the client only, `scrollRestoration: true` can stay. With SSR (TanStack Start), set `scrollRestoration: () => false`: TanStack scrolls the window to the top once it hydrates, even after a scroll made before then. `false` does not turn that off, and it also loses the scroll on reload. The stack still restores scroll on every move.

### Faster navigation {#tanstack-faster-navigation}

TanStack Router also draws a page only after its loader finishes, so on a move to a page not visited yet the stack waits while the loader gets its data. TanStack Router, though, caches loader data by default: back, or a move to a page you have visited, slides at once with the cached data, and the new data is fetched in the background and swapped in inside the same screen.

To make a first visit respond at once too, we recommend:

- **Streaming:** pass slow data as a promise instead of awaiting it, and read it with `<Await>`. The screen slides first and the data fills in later.
- **`pendingMs: 0`:** the `pendingComponent` slides in as the new screen right away, before the loader finishes. The default is one second, with no response until then.

`defaultPreload: "intent"` fetches data ahead when the pointer hovers a link, which helps a lot on desktop. On touch it only gains the short time from the finger landing to the click.

## Next.js App Router

```tsx
// app/layout.tsx
import { Stack } from "route-stack/next";

<body>
  <Stack>{children}</Stack>
</body>;
```

```ts
// instrumentation-client.ts, at the project root (or in src/)
export { onRouterTransitionStart } from "route-stack/next";
```

Next renders a navigation **before** it writes history. While rendering, the stack cannot ask history whether `/items?id=2` after `/items?id=1` is a push or a replace, which [`sameScreen`](/how-it-works/screens-and-history#what-is-a-new-screen) needs to decide. `onRouterTransitionStart` is Next's own hook for that: it runs in the browser just before each navigation, with its kind and URL, and the adapter keeps it until history catches up.

- Without the file, a navigation that changes only the query stays on the same screen, whatever `sameScreen` says. In development the adapter warns once in the console.
- The adapter reads the URL only in the browser, so `<Stack>` in the root layout does not block static rendering, even with `cacheComponents`.
- `animate`, a `swipe` function and `sameScreen` are functions, which a Server Component cannot pass. Wrap the stack in a Client Component:

```tsx check
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

- Intercepting and parallel routes (`@modal`) are not supported: see [Limitations](/reference/limitations#routers).

## Other routers

Any router that moves with `history.pushState`, `replaceState` and `popstate` works with the core `Stack`. Pass the rendered path with its query:

```tsx
import { Stack } from "route-stack";

// A router that draws the new page as soon as it writes history
<Stack path={location.pathname + location.search}>{page}</Stack>;

// A router that keeps drawing the old page while loading (`router.isLoading` is a made-up name)
<Stack
  path={renderedPath}
  view={() => (router.isLoading ? "stale" : "current")}
>
  {page}
</Stack>;
```

This is enough when the router renders after it writes history and renders synchronously. A router that renders before writing history, renders the old page while loading the new one, or holds navigations behind a confirm needs an adapter that also passes `view`: see [Writing an Adapter](/advanced/writing-an-adapter).

Hash routers and memory routers do not work: see [Limitations](/reference/limitations).
