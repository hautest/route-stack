# Limitations

## Requirements

- **React 19.2 or later; 19.3 or later recommended.** The stack keeps screens with `<Activity>`, stable since 19.2. Two React 19.2 bugs show with kept screens, both fixed in 19.3:
  - A portal rendered inside a screen stays on the page after the screen is hidden ([React #35000](https://github.com/facebook/react/issues/35000)): a modal, toast or menu portaled to `<body>` from a screen left open stays over the next one. On 19.2, close such overlays before navigating away.
  - A `<title>`, `<meta>` or `<link>` rendered inside a screen (React 19 hoists them to `<head>`) is not removed when the screen is hidden: the document can show a kept screen's title. On 19.2, set them outside the stack.
  - Before 19.2 there is no stable `<Activity>`: the stack does not run.
- **Router versions** are the ones the adapters are built and checked against: React Router 6.30+, TanStack Router 1.122+ (the adapter reads the `__TSR_key` it writes to history), Next.js 16+ (Next 15 ships a React without `Activity`). Earlier versions are not supported.
- **Browser history.** Hash routers (`createHashRouter`, hash history) put the path after `#`, which the stack treats as the same screen. Memory routers never touch `window.history`. Neither works.

## Layout

- **No `transform` or similar property on an ancestor of `<Stack>`**: fixed layers would be placed relative to it. For the list of properties, see [Troubleshooting](/reference/troubleshooting#screens-slide-to-the-wrong-place-or-vanish).
- **One `<Stack>` per document.** No nested stacks.

## Routers

- **One linear browser history.** No per-tab stacks or stacks inside modals.
- **No swipe back on an entry a `#` anchor added.** Tapping `<a href="#comments">` only scrolls within the same screen, and history gets one more entry. From there the entry right behind is the same screen, so no swipe opens; after going back with a back button, the swipe works again. In iOS Safari before 26.2, the swipe also stays off on a page after visiting one of its anchors. To keep anchor jumps out of history, use `element.scrollIntoView()`.
- **Router View Transitions must be off**: React Router `viewTransition`, TanStack `defaultViewTransition`. `document.startViewTransition` would capture the layers mid-slide.
- **Next.js intercepting and parallel routes** (`@modal`) are not supported. Opening a photo from a feed as a modal changes the pathname, so the stack renders the whole layout — feed and modal — again as a new screen and pushes it. Supporting it would need the adapter to tell a modal slot apart from a page, which Next does not expose. Open such modals with component state, or with a navigation that stays on the screen instead. A `?photo=` replace, for example, stays on it by default (see [`sameScreen`](/how-it-works/screens-and-history#what-is-a-new-screen)).
- **Routers with a stack of their own** (Ionic `IonRouterOutlet`, React Navigation on the web) or page transitions that hold the old page (Framer Motion `AnimatePresence`) do the same job and conflict.

## Transitions

- **Whole screens only.** No shared-element transitions (an image growing into the next page).
- **`transform` and `opacity` keyframes.** Other properties work but repaint every frame.
- **Finger drags at 60Hz on iOS.** Played slides run at 120Hz when the app allows it ([In a WebView](/guide/webview#_120hz)).
- **A frame drops on iOS each time a drag crosses 45% or 55%**, where the window behind the layers moves to the nearer screen.

## Browsers

- **iOS Safari (the browser, not a WebView) runs its own edge swipe alongside the stack's**: see [Troubleshooting](./troubleshooting#ios-safari-two-swipes).
- **Kept screens live in memory**, so a reload starts fresh.
- **The first screen after a reload or deep link has no screen behind it.** No swipe; the back button works.
- **A JS gesture without a declaration moves with the swipe.** A carousel or drawer moved with `transform` needs `touch-action: pan-y` or `data-stack-no-swipe`: see [Swipe Back](/guide/swipe-back#js-gestures).
- **Left-to-right only.** The swipe starts from the left edge and goes right, also in right-to-left documents.

## Not handled by the stack

- Refreshing the data of a kept screen when it shows again: the app's choice (its effects run again on reveal).
- Android back on the first screen (closing, exiting): the app's.
- Closing portals (modals, toasts) on navigation: the app's.
