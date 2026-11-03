---
"route-stack": patch
---

- Without the Navigation API (Safari before 26.2), a history state that is not a plain object (a string, an array, a Map) is kept as the app gave it; it was turned into an object.
- A swipe flicked back toward the edge stays, however far it was dragged, as on iOS.
- Next.js adapter: a path is under the base path only at a segment boundary (`/apple` is not under `/app`).
- A screen's history record is dropped once its entry is cut by a push (it stayed for good), and `--route-stack-progress` is not written again with the value it has.
