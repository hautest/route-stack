---
"route-stack": patch
---

A back the browser drew itself (Safari's swipe from the screen edge, `hasUAVisualTransition`) no longer slides a second time. Safari showed the screen arrived at, then the stack showed the one left again and slid it away. That traversal now changes screens with nothing moving, and writes no `--route-stack-progress`. It lasts a few frames, not the transition's duration: taps and scroll are held only that long. The entry replaced by another screen (a redirect, a tab bar) slides as ever, also while that change lasts.
