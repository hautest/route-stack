# route-stack

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
