---
"route-stack": patch
---

No touch or wheel on the stack scrolls the page while a slide's layers are up, as UIKit takes no touch during a transition. The scroll moved the window under the layers, and the end scrolled it back while the finger's scroll went on: iOS WebKit painted part of the screen blank. A finger put on the screen during a slide scrolls nothing until it lifts. Held by an element of the stack's own over the layers: elements outside the stack that are drawn over it (a tab bar, a sidebar) keep their touches.
