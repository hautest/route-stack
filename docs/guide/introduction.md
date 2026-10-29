# Introduction

route-stack brings native app navigation to the web, built first for web apps shown in an app's WebView. Every screen you navigate through stays mounted behind the current one, a push slides the new screen in, back slides it away to reveal the real previous screen, and on iOS a finger can drag that back from the left edge — or from anywhere on the screen.

<PhoneDemo />

## The problem

A router renders one page at a time. Go from a list to a detail page and the list is unmounted; go back and it renders again: data refetched, scroll restored late, inputs lost. Animating between the two is hard for the same reason — when the new page is on screen, the old one no longer exists.

The usual answer is the View Transition API: take a picture of the old page, render the new one, animate between the pictures. In a stack-style app that falls short:

- The old page must be captured before the DOM changes, and each router changes it at a different moment.
- Rendering is paused until the transition is set up, so a slow new page freezes the screen.
- During a swipe, the page behind is a picture: data loading in it does not show.
- Only one transition runs per document, and React starts its own.

## The approach

route-stack keeps the screens instead of pictures of them.

- **Screens stay alive.** Each screen you leave stays in the DOM, hidden by React's `<Activity>`: its state, inputs and scroll are kept, and its effects pause until it shows again.
- **Two live screens slide.** A push, a back, and a swipe all lift the two screens into viewport-sized layers and animate them with the Web Animations API — `transform` and `opacity` only, run by the compositor.
- **History decides.** Which screen an entry shows, and whether a move is a push, a back or a replace, comes from the browser's history — not from the router — so every router behaves the same.
- **The router is untouched.** You keep your routes, loaders and links. An adapter tells the stack only the path it rendered.

## When to use it

- A web app shown in an iOS or Android WebView that should feel like the native app around it.
- Mobile-first web apps where back should be instant and keep the page as it was.

When not to:

- A desktop site, or one where the browser's own swipe back is the gesture users expect: see [Limitations](/reference/limitations).
- Element-level shared transitions (a photo growing into the next page): route-stack slides whole screens.

Next: [Getting Started](./getting-started).
