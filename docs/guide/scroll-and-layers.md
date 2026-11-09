# Scroll & Layers

## Scroll is per screen

The stack owns the window scroll. Each screen keeps its own position: leave a list scrolled halfway, come back, and it is still halfway.

- A new screen starts at the top, or at the element `location.hash` points to (with its `scroll-margin-top`).
- A screen you go back to gets its saved position.
- `history.scrollRestoration` is set to `manual` while the stack is mounted.
- Router scroll restoration (`<ScrollRestoration>`, TanStack `scrollRestoration`) can stay on; the stack restores after it. With SSR (TanStack Start), though, TanStack scrolls the window to the top when it hydrates: see [TanStack Router](/guide/routers#tanstack-router).
- Scroll areas inside a page (`overflow: auto` elements) keep their own position: the browser keeps it, since the DOM stays.
- Moving inside one screen (`/page` to `/page#section` and back) does not restore scroll: it is the same screen.

## How a slide looks

During a slide both screens are lifted out of the page into viewport-sized `position: fixed` layers, each showing its content at its own scroll. When the slide ends they drop back into the page. Behind the layers the window is scrolled ahead to where the arriving screen sits, so the drop changes nothing on screen.

What this means for your CSS:

- `position: fixed` elements inside a screen (a floating button, a tab bar in the screen) stay in place in their layer.
- The layers are painted with the background of the first element, from the stack root up, that has one (`body`, `html`…), or else the page default.
- While a slide runs, the screen leaving is `inert`: no taps, no focus, no keyboard. The screen arriving takes focus (an `autoFocus`, a `focus()` in an effect) but no taps, and where a focus scrolls it down to a field, the slide ends there (a field above where it sits is focused without scrolling). Elements outside the stack keep working.

## Outside the stack

Elements outside `<Stack>` do not move with the screens. How they look during a slide depends on their positioning:

| Outside element                               | During a slide                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `position: fixed`                             | Stays exactly in place. **Use this.**                                                                                                                                                                                                                                    |
| In the normal flow above the stack (a header) | Not covered, but it pops in or out at the start or end of the slide when the two screens sit at different scroll positions. See [Troubleshooting](/reference/troubleshooting#a-header-above-the-stack-jumps). |
| In the normal flow below the stack (a footer) | Covered by the screen-sized layers during the slide, shown again when it ends.                                                                                                                                                                                           |
| `position: sticky`                            | Like the normal flow until it sticks, like fixed while stuck.                                                                                                                                                                                                            |
| `position: relative`                          | Like the normal flow. With a `z-index`, it is drawn over the sliding screens while in view; without, the layers cover it.                                                                                                                                                |
| `position: absolute`                          | Takes no room, so the layers start at the top. With a `z-index`, it is drawn over the sliding screens; without, the layers hide it until the slide ends. Either way it scrolls with the window, so it pops in or out when the screens sit at different scroll positions. |

Make shared headers and tab bars `position: fixed`, or put them inside the stack to slide with each screen.

```tsx
<>
  <header style={{ position: "fixed", top: 0, left: 0, right: 0 }}>…</header>
  <Stack>
    <Outlet />
  </Stack>
</>
```

- The stack root sets `isolation: isolate`: the layers' `z-index` stays inside it, and fixed elements outside keep their order.
- Keep `transform` and similar properties off the ancestors of `<Stack>`: the layers would be placed relative to that element, not the viewport. For the list of properties, see [Troubleshooting](/reference/troubleshooting#screens-slide-to-the-wrong-place-or-vanish).
- Portals (modals, toasts) render outside the stack and stay put. Closing them on navigation is the app's job.

## Composited elements: `data-stack-animating`

On iOS, WebKit paints a composited element blank for a frame or two when a slide starts. The stack scrolls the window as it lifts the layers, and until WebKit catches up it draws composited elements against the area shown before the scroll ([WebKit bug 310087](https://bugs.webkit.org/show_bug.cgi?id=310087)). Content that is not composited is painted first and does not flash. What flashes:

- a scroller (`overflow: auto`), which iOS composites
- an element composited at rest: `will-change: transform`, `translateZ(0)`, a `translate3d()`, or a carousel that positions its track with one

The part outside the area shown before the scroll goes blank, so the farther apart the two screens are scrolled, the more of it flashes.

The stack sets `data-stack-animating` on the two lifted screens during a slide. Turn compositing off under it:

```css
.carousel {
  overflow-x: auto;
}
.banner {
  will-change: transform;
}

[data-stack-animating] .carousel {
  overflow-x: hidden;
}
[data-stack-animating] .banner {
  will-change: auto;
}
```

- At rest the attribute is absent, and the elements keep their scrolling and compositing.
- A scroller set to `hidden` keeps its `scrollLeft`: nothing moves.
- A position given by `translate3d()` is restated in 2D, not removed: `transform: translate(-100%, 0)`, not `none`.
- A library that positions its track with an inline `translate3d()` (Embla Carousel does, at rest too) needs a patch to write `translate()`: the value changes with the position, so CSS cannot restate it.
- `<video>`, a `<canvas>` (WebGL, or a large 2D one) and an `<iframe>` whose content is composited can flash whatever their CSS.
- Android and desktop browsers are not affected.
- It costs nothing at rest: the attribute is set once when a slide starts and removed when it ends, on the two screens only.

`--route-stack-overflow` (deprecated) is still set to `hidden` on the same screens, so `overflow-x: var(--route-stack-overflow, auto)` keeps working. It will be removed in 1.0.

## Long lists

Showing a hidden screen again lays it out again. For a screen with a very long list, that can delay the first frame of a back. Let the browser skip off-screen rows:

```css
.feed-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 120px; /* about one row's height */
}
```

On a 1,000-row list at 6× CPU slowdown this took the first frame of a back from 485ms to 123ms.

## Element ids

Kept screens stay in the DOM, so two screens can hold the same `id` (two item pages, each with `id="price"`). The newest screen is rendered first in the DOM, so `getElementById`, `<label for>` and `#anchor` find the current screen's element.
