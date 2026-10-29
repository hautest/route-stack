# Troubleshooting

## iOS Safari: two swipes

**What you see:** in Safari (not in an app's WebView), dragging from the left edge shows Safari's own back preview, and at the end the page jumps.

**Why:** Safari's back swipe cannot be turned off by a page. The stack's swipe starts at the same time, lifts the screens and scrolls the window, while Safari shows a snapshot of the page. When Safari puts the live page back, it differs from the snapshot.

**Fix:** turn the stack's swipe off in Safari, and leave the gesture to Safari:

```tsx
const inSafari =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) && // iPadOS Safari sends a Mac UA
  /Safari\//.test(navigator.userAgent) && // WKWebView has no "Safari/"
  !matchMedia("(display-mode: standalone)").matches;

<Stack swipe={inSafari ? false : undefined}>
```

The check also matches Chrome and Firefox on iOS, which have the same swipe. `undefined` keeps the default, so Android stays off.

A web app added to the home screen (`display-mode: standalone`) has no Safari swipe, so the stack's stays on there.

## A scroller flashes during a slide (iOS)

A horizontal carousel or any `overflow: auto` element goes blank for a frame while screens slide. Use the overflow variable:

```css
.carousel {
  overflow-x: var(--route-stack-overflow, auto);
}
```

See [Scroll & Layers](/guide/scroll-and-layers#horizontal-scrollers-route-stack-overflow).

## Back starts late on a long page

The first frame of a back waits for the kept screen to be laid out again. Use `content-visibility: auto` on long lists: see [Scroll & Layers](/guide/scroll-and-layers#long-lists).

With React Router, back also waits for the loaders of the screen it returns to. Data caching or streaming shortens that wait (see [Faster navigation](/guide/routers#faster-navigation)).

## A header above the stack jumps

An element in the normal flow above `<Stack>` scrolls with the window, and the window is moved behind the layers during a slide. When the two screens sit at different scroll positions, the header pops in or out. Make it `position: fixed` and pad the screens, or move it inside the stack. See [Scroll & Layers](/guide/scroll-and-layers#outside-the-stack).

## Screens slide to the wrong place or vanish

During a slide both screens are `position: fixed` layers, placed on the viewport. By a CSS rule, an element with any of these properties becomes the containing block of its fixed descendants instead, so the layers are placed — and scrolled — relative to it:

`transform` (and `translate`, `scale`, `rotate`), `perspective`, `filter`, `backdrop-filter`, `will-change` naming any of them, `contain: paint | layout | strict | content`.

Common sources on an ancestor of `<Stack>`:

- a "GPU acceleration" hack such as `transform: translateZ(0)` or `will-change: transform` on an app wrapper;
- a page-transition wrapper (Framer Motion `motion.div`) that keeps a transform;
- `filter: blur()` on the page behind an open modal;
- a whole-app `transform: scale()` for zoom or a device preview.

In development the stack warns in the console when the first slide starts, naming the ancestor and the property. Remove the property, or move the stack out of that element. Transforms inside the screens, or on elements next to the stack, are fine.

## Two transitions play at once

A router View Transition is on. Turn off React Router `viewTransition` and TanStack `defaultViewTransition`.

## Next.js: a query change does not slide

A push from `/items?id=1` to `/items?id=2` stays on the same screen. `instrumentation-client.ts` is missing — in development the console says so:

```ts
// instrumentation-client.ts
export { onRouterTransitionStart } from "route-stack/next";
```

## Next.js: "Functions cannot be passed directly to Client Components"

`animate`, a `swipe` function or `sameScreen` was passed from a Server Component (`layout.tsx`). Wrap the stack in a Client Component: see [Routers](/guide/routers#next-js-app-router).

## Seeing what the stack does

Set the debug log and watch the events: see [API](/reference/api#debug-log). `late-scroll` means the window was not where the arriving screen sits when a slide ended — something else scrolled it during the slide.
