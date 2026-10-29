# Screens & History

## What is a new screen

A screen is decided by history, at the moment an entry becomes current.

| Move                     | Same screen when                                            | Otherwise   |
| ------------------------ | ----------------------------------------------------------- | ----------- |
| push                     | the URL without `#` is the same (`/page` → `/page#section`) | new screen  |
| replace                  | the pathname is the same (`/search?q=a` → `/search?q=ab`)   | new screen  |
| traverse (back, forward) | the entry was seen before → its screen                      | as for push |

That is the default rule, `defaultSameScreen`. So:

- `/items?id=1` → push `/items?id=2` is a new screen with a slide. Back returns to `id=1` as it was.
- Typing in a search box that replaces `?q=`, or a sort that replaces `?sort=`, keeps the same screen: no remount, the input keeps focus.
- A replace to another path (a redirect) is a new screen.

The `sameScreen` prop changes the rule for push and replace: a function of `from`, `to` and the kind. `from` and `to` are URLs as the address bar has them, without the origin: pathname, query and `#fragment`, a base path included. A traverse to an entry not seen before is asked as a push. The stack also asks it about the path it renders, which has no `#fragment` nor base path, with either kind: keep the function free of side effects. For example, return `false` when `?sort=` changes to make a sort a new screen: it slides in with the `replace` direction, which the built-in transitions play as a push, and the replaced screen is dropped (see [What is a screen](/guide/getting-started#what-is-a-screen)). Or return `true` when only `?tab=` changes to keep a tab push on its screen.

## Push, replace, traverse

History moves in three ways — the kinds of the Navigation API:

| Kind     | What                       | Examples                                                                          |
| -------- | -------------------------- | --------------------------------------------------------------------------------- |
| push     | adds an entry              | link, `navigate()`, `router.push()`                                               |
| replace  | changes the current entry  | `navigate(…, { replace: true })`, `router.replace()`, redirects                   |
| traverse | moves to an existing entry | back/forward buttons, `history.back()`, `history.go(n)`, swipe back, Android back |

A traverse has no direction of its own. The stack compares where the two screens were last seen in history: earlier is `back`, later is `push`. That is the `direction` passed to `animate`.

## Kept screens

A screen stays while some entry at or behind the current one still shows it.

- Back from B to A: B is dropped when the slide ends, since only an entry ahead shows it. Forward to B renders it again.
- A replace to a new screen drops the replaced screen.

There is no limit on the number of kept screens.

## Navigation API and the fallback

Where the Navigation API exists, the stack reads entries from it. Elsewhere (Safari before 26.2) it keeps a key and an index in `history.state`:

- It merges into the state the router writes; routers keep their own fields.
- Entries created before route-stack loaded (or by `#anchor` links) are remembered by URL.
- Load route-stack with the app, before the first navigation: entries made before it share one index, so their order is unknown.

## Next.js order

Next renders a navigation before it writes history ([Routers](/guide/routers#next-js-app-router)). The adapter's `view()` answers `{ ahead: "push" }` or `{ ahead: "replace" }` with the URL from `onRouterTransitionStart`, and the stack asks `sameScreen` with them before history has the entry.
