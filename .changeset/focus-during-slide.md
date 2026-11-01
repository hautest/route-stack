---
"route-stack": patch
---

A screen sliding in keeps focus: an `autoFocus` or a `focus()` in an effect was lost to `inert` during the slide. Only the screen leaving is `inert` now; the one arriving takes focus but no taps. Where a focus scrolls the arriving screen (a field far below), the slide ends at that scroll instead of jumping back.
