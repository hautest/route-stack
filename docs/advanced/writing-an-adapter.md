# Writing an Adapter

An adapter connects a router the stack does not know. It is a small component around the core `Stack`.

```tsx
import { Stack as Core, type StackProps, type View } from "route-stack";

export function Stack(props: Omit<StackProps, "path">) {
  const path = useRenderedPath(); // the path with query this render draws
  return <Core {...props} path={path} view={() => viewOf(path)} />;
}
```

## `path`

The path **with its query** of what the router renders now — not of the URL. They differ while a router still renders the old page as it loads the next one. Pass the one being drawn: a screen must never receive another page's content.

## `view()`

What this render is for the current history entry. Only the router can tell. The stack calls it when it needs it, not once per render:

- while rendering, for `ahead`, and for `current` when the current entry's screen is hidden at another path: a `stale` render does not reuse that screen;
- at the commit, for `current` or `stale`;
- a frame after a traversal under a swipe's back, for `held`.

It is never called on the server.

```ts
type View =
  | "current"
  | "stale"
  | "held"
  | { ahead: "push" | "replace"; url: string };
```

| Value       | Return it when                                                                                                                              | The stack                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `"current"` | The render is the current entry's content                                                                                                   | Commits it: picks the direction, slides                    |
| `"stale"`   | History moved, but the router still renders the screen left (loaders, data)                                                                 | Ignores the commit and waits for the next                  |
| `"held"`    | The router refuses the entry history went to (a blocker asks)                                                                               | Slides a swipe's back to rest                              |
| `{ ahead }` | The router renders a push or replace before writing history; `url`, where it goes as history will have it (absolute, or with the base path) | Asks `sameScreen` with the kind: new screen or same screen |

Without `view`, every render is `"current"`. That is right for a router that writes history first and renders the new page at once.

## Rules

- **Re-render on every history change**, even to the same path. A guard redirecting a back to the screen already shown changes only the entry; the stack learns it is current at a commit.
- **Read state when called.** `view()` must answer for the moment it is called, not for when the component rendered.
- **No `ahead` for a traversal.** Back and forward move history before any router renders.

## The three adapters

| Adapter         | `path`                                                     | `view()`                                                                                                                                                                |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Router    | `useLocation()` pathname + search                          | Rendered `location.key` equals `history.state.key`: `current`, else `stale`                                                                                             |
| TanStack Router | The last match the outlet renders                          | Router's own key differs from `history.state`: `held`. The location navigated to is the current entry and its matched path is the rendered one: `current`, else `stale` |
| Next.js         | `usePathname()` + `useSearchParams()`, in the browser only | A hint from `onRouterTransitionStart` for this pathname: `{ ahead, url }`. Else the path equals the current URL: `current`, else `stale`                                |

Read them in `packages/route-stack/src/adapters/` for working examples.
