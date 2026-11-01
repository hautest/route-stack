# route-stack

## 0.1.1

### Patch Changes

- 42dbbc6: A screen sliding in keeps focus: an `autoFocus` or a `focus()` in an effect was lost to `inert` during the slide. Only the screen leaving is `inert` now; the one arriving takes focus but no taps. Where a focus scrolls the arriving screen (a field far below), the slide ends at that scroll instead of jumping back.

## 0.1.0

### Minor Changes

- 876c484: First release: a native-app-like screen stack on the router you already use (Next.js App Router, React Router, TanStack Router). Kept screens, push/back slides, and an interactive swipe back from the edge or the whole screen.
