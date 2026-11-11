---
"route-stack": patch
---

A screen entered at the top no longer shows shifted in iOS Safari. WebKit drops a `scrollTo(0, 0)` while the window is scrolled less than the height of Safari's top bar: the page read 0 and was still drawn at the old scroll, the new screen up to that far off until the next scroll. Behind the layers, the document is no longer made shorter while the window has to move (that clamped it to under the bar), and a window less than a viewport down reaches the top by way of a viewport down, two frames apart. A slide shorter than that waits for it before it drops its layers. Not for a navigation without animation.
