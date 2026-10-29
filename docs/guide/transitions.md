# Transitions

## Presets

| Preset     | Looks like                                                                                                        | Duration | Easing |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| `ios`      | UIKit navigation push: the new screen slides in over the old one, which moves 30% left and darkens                | 350ms | `ease` |
| `android`  | Android 14+ activity transition: the new screen slides in from 10% and fades in early; the old one moves 10% left | 450ms | `cubic-bezier(0.2, 0, 0, 1)` |
| `material` | Material shared axis X: both screens move 30px and cross-fade                                                     | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

The default picks per platform: `android` on Android, `ios` elsewhere.

<PhoneDemo preset="material" />

## Choosing with `animate`

`animate` runs for every screen change and returns the transition to play, or `false` for none. The stack also calls it at rest to check whether a swipe back may start, so keep it pure and cheap.

```tsx
import { ios, material } from "route-stack";

<Stack
  animate={(from, to, direction) => {
    if (to.startsWith("/tabs/")) return false; // tab switches: no slide
    if (to.startsWith("/settings")) return material;
    return ios;
  }}
>
```

| Argument    | Value                                  |
| ----------- | -------------------------------------- |
| `from`      | Path with query of the screen leaving  |
| `to`        | Path with query of the screen arriving |
| `direction` | `"push"`, `"back"` or `"replace"`      |

- The browser's forward button is a `"push"`: it slides in the screen it returns to.
- `history.go(-3)` is one `"back"`.
- A swipe back uses `animate(from, to, "back")` too; returning `false` there also turns the swipe off for that pair.
- `false` still switches screens and keeps the one left.

## Your own transition

A transition is data: keyframes for each screen, played forward on push and reversed on back (unless it has a `back` of its own).

```ts check
import type { Transition } from "route-stack";

export const fade: Transition = {
  duration: 250,
  easing: "ease-out",
  enter: [{ opacity: 0 }, { opacity: 1 }],
  leave: [{ opacity: 1 }, { opacity: 0 }],
  enterOnTop: true,
};
```

| Field        | Meaning                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `duration`   | Length of the animation in milliseconds. A swipe's release plays the rest over the full duration, whatever the distance left |
| `easing`     | CSS easing of a played slide (push, back, the rest of a swipe after release). A finger follows linearly                      |
| `enter`      | Keyframes of the screen coming in on push                                                                                    |
| `leave`      | Keyframes of the screen going out on push                                                                                    |
| `shade`      | Optional keyframes of a black layer over the lower screen, to darken it (`opacity` only)                                     |
| `shadow`     | Optional fixed `box-shadow` of the upper screen during the slide                                                             |
| `enterOnTop` | Whether the screen coming in is drawn above the one leaving                                                                  |
| `back`       | Optional `enter` / `leave` / `shade` of its own for back, played forward. Without it, back plays push reversed. A `back` without a `shade` has none (not the push's) |

Keyframes are [Web Animations](https://developer.mozilla.org/docs/Web/API/Web_Animations_API) keyframes: any animatable CSS property works. Performance differs:

| Properties                                                                  | Run by          | Cost                                                                        |
| --------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `transform` (`translate`, `scale`, `rotate`), `opacity`                     | The compositor  | Smooth even when the page is busy; 120Hz on ProMotion iPhones               |
| `filter`, `clip-path`, `border-radius`, `background-color`, `box-shadow`, … | The main thread | Repaint a screen-sized layer every frame; can drop frames on low-end phones |
| `width`, `height`, `top`, `left`, `margin`, …                               | The main thread | Lay out the screen every frame; avoid                                       |

- The presets use only `transform` and `opacity`.
- `shadow` is a static style on the upper layer, not animated.
- Without a `back`, the keyframes play in reverse on back: the screen coming back takes `leave`, the one going takes `enter`.
- On back the layers stack as they did on push: with `enterOnTop`, the screen that came in on push stays on top.
