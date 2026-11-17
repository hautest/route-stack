---
"route-stack": patch
---

Fix the color painted behind screens during a transition. An ancestor painted with an opaque color whose last channel is 0 (black, red, yellow) is no longer skipped as transparent, a color whose alpha after a slash is 0 (`oklch(0 0 0 / 0)`) now is, and with no painted ancestor the layers take the page canvas color in html's color scheme.
