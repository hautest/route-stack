# Overview

## The pieces

```text
 router ──path, view()──▶ adapter ──▶ <Stack>  (React binding)
                                         │ resolve · commit
                                         ▼
 history ──push/replace/traverse──▶   Core   ◀──drag/release── swipe
                                         │
                                         ▼
                              slide: layers · aim · motion
```

| Piece         | Job                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **history**   | Wraps the Navigation API (or a fallback on `history.state`). Tells which screen each history entry shows, and the kind of every move. |
| **Core**      | A state machine: the screens, the one shown, and the slide between two of them. No React, no router.                                  |
| **`<Stack>`** | The React binding. Renders every kept screen inside `<Activity>`, and hands each render and commit to the core.                       |
| **adapter**   | Reads the router: the path it rendered, and whether that render is for the current entry (`view()`).                                  |
| **slide**     | Lifts two screens into layers, scrolls the window behind them, plays keyframes.                                                       |
| **swipe**     | Turns a touch at the left edge (or anywhere, with `swipe="full"`) into progress and a release, unless the page takes the drag.        |

## The DOM

```html
<div data-stack-root style="isolation: isolate">
  <div data-stack-screen="3">
    <!-- current: newest first -->
    <div data-stack-content>…</div>
    <!-- shown -->
  </div>
  <div data-stack-screen="1">
    <!-- kept -->
    <div data-stack-content style="display: none">…</div>
  </div>
</div>
```

- Each screen is a host `div` (the layer a slide moves) around a content `div` (what React's `<Activity>` hides).
- Hidden screens keep their DOM and React state. Their effects stop while hidden and run again when shown.
- Hidden screens do not re-render: the stack keeps them suspended, so an update in the app does not reach them.

## One navigation

A push from a list to a detail page:

```text
 1  router navigates           history: push, entry 2 → new screen
 2  React renders <Stack>      resolve: this path → new screen (pending)
 3  layout effect (pre-paint)  commit: screen 2 shown, direction push
 4  slide starts               both screens lifted, window scrolled to 0 behind them
 5  slide ends                 settle: layers dropped, list hidden, unreachable screens pruned
```

Steps 2 to 4 happen before the browser paints, so the first frame already shows both screens in place.

| Case                      | Difference                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Back                      | History says traverse; the screen it lands on is kept, so step 2 reuses it. Direction back: keyframes reversed.                      |
| `animate` returns `false` | Step 4 is skipped: settle at once.                                                                                                   |
| Swipe back                | Step 4 comes first, driven by the finger. On release the stack calls `history.back()`, and steps 1–3 follow under the running slide. |
| Navigation during a slide | The running slide ends where React already is, and the new one starts.                                                               |
| Redirect during a slide   | The screen sliding in is replaced; the slide goes on to the new one.                                                                 |

## Scrolling ahead

A layer shows its content at its saved scroll by offsetting it, while the real window scroll sits behind the layers. Before a slide ends, the window is moved to where the arriving screen will sit. Then dropping the layers changes nothing on screen.

Dropping the layers and jumping the scroll in the same frame made iOS WebKit paint a blank frame. Scrolling ahead avoids that.

- Push and button back: the window moves when the slide starts.
- Swipe: the window follows the nearer screen — past 55% the arriving one, under 45% the leaving one — so whichever way the release goes, it is already there.

## Frames

- A played slide (push, back, the rest of a swipe) is a Web Animation the compositor runs.
- A finger drag seeks the animation from JavaScript each frame.

For the frame rates in an iOS WebView, see [In a WebView](/guide/webview#_120hz).
