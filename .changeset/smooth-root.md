---
"route-stack": patch
---

A page with `scroll-behavior: smooth` on its root no longer ends a slide with the screen still scrolling into place: the stack's own scrolls of the window are instant. They also leave the window where it is across: a page scrolled sideways no longer jumps to its left edge with a slide.
