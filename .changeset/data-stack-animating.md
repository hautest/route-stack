---
"route-stack": minor
---

Add `data-stack-animating`, set on the two lifted screens during a slide. On iOS, an element drawn on its own layer (a composited layer: a scroller, `will-change: transform`, a 3D transform) went blank for a frame or two when a slide started; turn that off under `[data-stack-animating]`.

Breaking: `--route-stack-overflow` is removed. `var(--route-stack-overflow, auto)` still falls back to `auto` without an error, so the flash returns silently. Replace it with `overflow-x: auto` and `[data-stack-animating] .scroller { overflow-x: hidden }`.
