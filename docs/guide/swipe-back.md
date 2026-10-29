# Swipe Back

The default swipe back differs by platform. On iOS, drag from the left edge of the screen to go back. On Android the swipe is off by default, since the system back gesture handles it. Each platform also gets its own default transition. With `swipe="full"`, a drag from anywhere on the screen goes back on both.

The transitions are web animations, not platform features, so they are not tied to a platform: use the iOS transition on Android, or the other way around, if you prefer (see [Transitions](./transitions)).

While you drag, the screen follows your finger with the previous screen behind it — the real, live screen, not a snapshot. On release it either goes back or settles back into place.

<PhoneDemo />

## The `swipe` prop

```tsx
<Stack>                 // omitted: the edge on iOS and others, off on Android
<Stack swipe="edge">    // the edge on every platform (Android too)
<Stack swipe="full">    // anywhere on the screen, on every platform
<Stack swipe={false}>   // off on every platform
```

| `swipe`    | iOS                                                               | Android        |
| ---------- | ----------------------------------------------------------------- | -------------- |
| (default)  | From the edge                                                     | None           |
| `"edge"`   | From the edge                                                     | From the edge¹ |
| `"full"`   | From anywhere                                                     | From anywhere¹ |
| `false`    | None                                                              | None           |
| a function | Decided for each back, from the paths ([Swipe per screen](#per-screen)) |                |

- ¹ See [Android](#android).
- A back for which `animate` returns `false` has no swipe either: there is no slide to follow the finger.
- Wherever there is no swipe, the back button and history back still work and animate.

Try each in the demo's selects.

## Android

In Android's gesture navigation, a swipe from the left or right edge of the screen is the system back. The system takes that touch first, so even with `"edge"` the stack's swipe does not start and the system back runs instead. That is why the stack leaves the swipe off on Android by default. The system back arrives as `history.back()`, so the back transition still plays.

To use the swipe on Android too, set `swipe`. On devices with button navigation, `"edge"` works. On devices with gesture navigation, the stack only gets a drag that starts away from the edges (`"full"`).

## From anywhere on the screen

```tsx
<Stack swipe="full">
```

With the full-screen swipe, a sideways drag anywhere on the shown screen goes back, as the full-screen back gesture of iOS 26 apps does. Elements that use sideways drags themselves, such as horizontal scrollers and sliders, get the drag first. A horizontal scroller scrolled all the way to the start lets the next drag swipe back (see [What the page keeps](#what-the-page-keeps)).

Use it when the app's horizontal gestures can be told apart: native scrollers and controls are, but a carousel or drawer moved with JS moves with the swipe unless it declares itself (see [JS gestures](#js-gestures)). On a screen full of such gestures, keep only the edge there with a function.

## Swipe per screen {#per-screen}

Pass a function to `swipe` to choose the swipe per screen. The stack calls it whenever it decides whether a swipe can open, with the path of the screen shown (`from`) and of the screen the swipe would go back to (`to`); it returns `"edge"`, `"full"` or `false`.

```tsx
<Stack
  swipe={(from, to) => {
    // Checkout and editor: off, so nobody leaves by accident
    if (from.startsWith("/checkout") || from.startsWith("/editor")) return false;
    // Map: the edge only, so it does not fight dragging the map
    if (from.startsWith("/map")) return "edge";
    return "full";
  }}
>
```

- `false` turns the swipe off on that screen, and touches go to the page.
- Decide by path only. State inside a page, such as a form being edited, does not make the stack call the function again. To keep people from leaving with unsaved input, use your router's blocker (see [Routers that hold a back](#routers-that-hold-a-back)).
- With Next.js, pass the function from a Client Component (see [Routers](./routers#next-js-app-router)).

## The gesture

The swipe is decided in this order.

1. **Where it starts:** with the edge swipe (`swipe="edge"`), only a touch on the shown screen that starts within 20px of the window's left edge. With the full-screen swipe (`swipe="full"`), a touch anywhere on the shown screen.
2. **When it starts:** once the finger has moved 10px, and more to the right than up or down.
3. **Going back:** releasing after covering 40% of the distance left to the right edge, or moving faster than 1px/ms over the last 100ms, goes back.
4. **Staying:** otherwise the screen settles back into place. It also settles back when the system takes the touch (`touchcancel`) or a second finger lands.
5. **After release:** the rest of the slide plays with the transition's duration and easing.

- There is nothing laid over the page: a tap at the edge reaches the button under it, and a vertical drag from the edge scrolls.
- A swipe can only start when there is a screen to go back to. On the first screen after a reload or a deep link there is none: no swipe (the back button still works).
- After the release, `history.back()` is called, and the router handles it as any back.

## What the page keeps

When the finger has moved 10px, more to the right than up or down, the stack looks at what it touched. The drag stays the page's when:

| Under the finger                                                                                         | At the edge | Elsewhere  |
| -------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| A control that drags sideways: range sliders, `video` and `audio`, `role="slider"` or `role="scrollbar"` | the page's  | the page's |
| An element with `data-stack-no-swipe`, or inside one                                                     | the page's  | the page's |
| Text: text fields, `textarea`, `select`, `contenteditable` (a drag moves the caret or the selection)     | swipe       | the page's |
| An element declaring `touch-action` without `pan-x` (`pan-y`, `none`; not `auto` or `manipulation`), or inside one | swipe       | the page's |
| A horizontal scroller that can still scroll back to the left                                             | swipe       | the page's |
| A horizontal scroller at its start, or anything else                                                     | swipe       | swipe      |

- At its start, a scroller has nothing to scroll back to: the swipe goes back, as a native scroll view at its edge does. At the edge, the swipe wins over text, scrollers and declared gestures, as a native edge gesture does.
- The element actually touched counts, also inside a shadow root (a slider in a web component).
- Only the shown screen counts. A touch on an element outside it — a sheet or a modal portaled to `<body>` — never starts a swipe, and nothing on an ancestor of the stack is read: an app root's `touch-action: pan-y` or `data-stack-no-swipe` does not turn the swipe off.
- A page pinched in keeps its drags: they pan the zoomed view.
- Checkboxes, radio buttons and buttons are only tapped: a drag on them swipes.

### JS gestures

A carousel or a drawer that moves an element with JS (`transform`) gives the stack nothing to see. Without a declaration, it and the swipe move together. Declare it, either way:

```css
.carousel {
  touch-action: pan-y; /* the browser scrolls vertically; this element handles horizontal drags */
}
```

```html
<div data-stack-no-swipe>…</div>
```

Most carousel libraries (Swiper, Embla) set `touch-action` already. `data-stack-no-swipe` also turns the edge swipe off over the element.

## Cost

To take a drag before the browser scrolls, the stack adds a `touchmove` listener that is not passive while a swipe can start (a screen to go back to, no slide running, and the back allowed by `swipe` and `animate`) — also with the edge swipe only. The browser then waits for the page before it starts a scroll. The first screen has no listener.

Measured once each on an iPhone 15 Pro (WKWebView) and a Galaxy S24 (Android WebView):

- Page idle: scrolls started as fast as without the listener.
- Main thread kept busy on purpose (40ms of every 80ms): scrolls started about 10ms later on the Galaxy. The iPhone measurement could not tell a difference.

## Routers that hold a back

If the router refuses the back — a blocker asking "Leave this page?" — the screen slides back to rest. Choosing to leave then is a back of its own, with its own transition. React Router and TanStack Router blockers are covered.

## iOS Safari (the browser)

Safari's own edge swipe runs alongside the stack's: see [Troubleshooting](/reference/troubleshooting#ios-safari-two-swipes).
