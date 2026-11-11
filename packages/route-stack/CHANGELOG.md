# route-stack

## 0.3.0

### Minor Changes

- c7a5c9a: The stack keeps its own record of history entries (a key and an index in `history.state`) in every browser, and no longer reads the Navigation API. In Safari's private windows the API does not follow `pushState` and `replaceState`: its entries went stale, a back was taken for a push, and the screen came back at the top. The record was already what Safari before 26.2 ran on.

  Navigating to a `#` anchor (`<a href="#…">`, `location.hash`, `location.replace("#…")`) is no longer supported: the record cannot tell the entries it adds or rewrites apart, and what a back or a swipe shows after one is not guaranteed. A console warning says so once in development. Use `element.scrollIntoView()`.

  Also: after a reload on an entry that carries no stamp, entries stamped before it are forgotten rather than compared with the ones after. A popstate that a wrapper of `history` installed before the stack dispatches for a push (single-spa) is no longer taken for a traversal.

- c7a5c9a: The layers take the stack's place across, not the viewport's: a stack beside a sidebar slides beside it, where it used to jump to the viewport's left edge and width for the slide. The swipe measures its edge and its distance from the stack's edges too. The sliding screens are not clipped to the stack: what is beside it in the normal flow is slid over, so it has to be drawn over the stack.

### Patch Changes

- c7a5c9a: A back the browser drew itself (Safari's swipe from the screen edge, `hasUAVisualTransition`) no longer slides a second time. Safari showed the screen arrived at, then the stack showed the one left again and slid it away. That traversal now changes screens with nothing moving, and writes no `--route-stack-progress`. It lasts a few frames, not the transition's duration: taps and scroll are held only that long. The entry replaced by another screen (a redirect, a tab bar) slides as ever, also while that change lasts.
- c7a5c9a: A page with `scroll-behavior: smooth` on its root no longer ends a slide with the screen still scrolling into place: the stack's own scrolls of the window are instant. They also leave the window where it is across: a page scrolled sideways no longer jumps to its left edge with a slide.
- c7a5c9a: No touch or wheel on the stack scrolls the page while a slide's layers are up, as UIKit takes no touch during a transition. The scroll moved the window under the layers, and the end scrolled it back while the finger's scroll went on: iOS WebKit painted part of the screen blank. A finger put on the screen during a slide scrolls nothing until it lifts. Held by an element of the stack's own over the layers: elements outside the stack that are drawn over it (a tab bar, a sidebar) keep their touches.
- c7a5c9a: A screen entered at the top no longer shows shifted in iOS Safari. WebKit drops a `scrollTo(0, 0)` while the window is scrolled less than the height of Safari's top bar: the page read 0 and was still drawn at the old scroll, the new screen up to that far off until the next scroll. Behind the layers, the document is no longer made shorter while the window has to move (that clamped it to under the bar), and a window less than a viewport down reaches the top by way of a viewport down, two frames apart. A slide shorter than that waits for it before it drops its layers. Not for a navigation without animation.

## 0.2.0

### Minor Changes

- 49bdf4a: Add `data-stack-animating`, set on the two lifted screens during a slide. On iOS, an element drawn on its own layer (a composited layer: a scroller, `will-change: transform`, a 3D transform) went blank for a frame or two when a slide started; turn that off under `[data-stack-animating]`.

  Breaking: `--route-stack-overflow` is removed. `var(--route-stack-overflow, auto)` still falls back to `auto` without an error, so the flash returns silently. Replace it with `overflow-x: auto` and `[data-stack-animating] .scroller { overflow-x: hidden }`.

## 0.1.2

### Patch Changes

- 04dfb00: - Without the Navigation API (Safari before 26.2), a history state that is not a plain object (a string, an array, a Map) is kept as the app gave it; it was turned into an object.
  - A swipe flicked back toward the edge stays, however far it was dragged, as on iOS.
  - Next.js adapter: a path is under the base path only at a segment boundary (`/apple` is not under `/app`).
  - A screen's history record is dropped once its entry is cut by a push (it stayed for good), and `--route-stack-progress` is not written again with the value it has.

## 0.1.1

### Patch Changes

- 42dbbc6: A screen sliding in keeps focus: an `autoFocus` or a `focus()` in an effect was lost to `inert` during the slide. Only the screen leaving is `inert` now; the one arriving takes focus but no taps. Where a focus scrolls the arriving screen (a field far below), the slide ends at that scroll instead of jumping back.

## 0.1.0

### Minor Changes

- 876c484: First release: a native-app-like screen stack on the router you already use (Next.js App Router, React Router, TanStack Router). Kept screens, push/back slides, and an interactive swipe back from the edge or the whole screen.
