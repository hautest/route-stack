---
"route-stack": minor
---

Add `data-stack-animating`, set on the two lifted screens during a slide. On iOS, a composited element (a scroller, a `will-change: transform`, a `translate3d()` at rest) flashed blank for a frame or two when a slide started; turn its compositing off under `[data-stack-animating]`.

Breaking: `--route-stack-overflow` is removed. Replace `overflow-x: var(--route-stack-overflow, auto)` with `overflow-x: auto` plus `[data-stack-animating] .scroller { overflow-x: hidden }`.
