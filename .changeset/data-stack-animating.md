---
"route-stack": minor
---

Add `data-stack-animating`, set on the two lifted screens during a slide. On iOS, a composited element (a scroller, a `will-change: transform`, a `translate3d()` at rest) flashed blank for a frame or two when a slide started; turn its compositing off under `[data-stack-animating]`. `--route-stack-overflow` is deprecated in its favor and will be removed in 1.0.
