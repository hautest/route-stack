---
"route-stack": minor
---

The stack keeps its own record of history entries (a key and an index in `history.state`) in every browser, and no longer reads the Navigation API. In Safari's private windows the API does not follow `pushState` and `replaceState`: its entries went stale, a back was taken for a push, and the screen came back at the top. The record was already what Safari before 26.2 ran on.

Navigating to a `#` anchor (`<a href="#…">`, `location.hash`, `location.replace("#…")`) is no longer supported: the record cannot tell the entries it adds or rewrites apart, and what a back or a swipe shows after one is not guaranteed. A console warning says so once in development. Use `element.scrollIntoView()`.

Also: after a reload on an entry that carries no stamp, entries stamped before it are forgotten rather than compared with the ones after. A popstate that a wrapper of `history` installed before the stack dispatches for a push (single-spa) is no longer taken for a traversal.
