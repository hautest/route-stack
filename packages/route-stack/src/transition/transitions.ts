import type { Animate, Transition } from "../types";

/**
 * iOS-style push: the new screen slides in over the old one, which moves a
 * little and darkens. No edge shadow (as stackflow): a shadow is painted into
 * the moving screen-sized layer, and iOS WebKit visibly repainted it as the
 * layer left the screen at the end of a back.
 */
export const ios: Transition = {
  duration: 350,
  // As stackflow (a CSS transition with the default timing): motion stays
  // visible to the end, so the screen does not look settled while the
  // transition still holds touches.
  easing: "ease",
  enter: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
  leave: [{ transform: "translateX(0)" }, { transform: "translateX(-30%)" }],
  shade: [{ opacity: 0 }, { opacity: 0.12 }],
  enterOnTop: true,
};

/**
 * Material shared axis X: the new screen comes 30dp from the right fading in,
 * the old one goes 30dp left fading out, through each other (out by 35%, then
 * in), as MDC's MaterialSharedAxis. Both screens are nearly transparent at 35%:
 * the page background shows for a moment.
 */
export const material: Transition = {
  duration: 300,
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: [
    { transform: "translateX(30px)", opacity: 0 },
    { opacity: 0, offset: 0.35 },
    { transform: "translateX(0)", opacity: 1 },
  ],
  leave: [
    { transform: "translateX(0)", opacity: 1 },
    { opacity: 0, offset: 0.35 },
    { transform: "translateX(-30px)", opacity: 0 },
  ],
  enterOnTop: true,
};

/**
 * Android's own activity transition (Android 14+): the new screen slides in
 * from 10% over the old one, fading in early (after 50ms, for 83ms); the old
 * one slides 10% left and stays opaque, so nothing between them ever shows.
 * Back is not this reversed: the screen leaving fades out early (natively
 * after 35ms, for 83ms) as it slides 10% right, the one under it slides in
 * from -10%. Fades sit at the native times as progress: the easing over the
 * whole slide shortens them, as on push.
 */
export const android: Transition = {
  duration: 450,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  enter: [
    { transform: "translateX(10%)", opacity: 0 },
    { opacity: 0, offset: 0.11 },
    { opacity: 1, offset: 0.3 },
    { transform: "translateX(0)", opacity: 1 },
  ],
  leave: [{ transform: "translateX(0)" }, { transform: "translateX(-10%)" }],
  enterOnTop: true,
  back: {
    enter: [{ transform: "translateX(-10%)" }, { transform: "translateX(0)" }],
    leave: [
      { transform: "translateX(0)", opacity: 1 },
      { opacity: 1, offset: 0.08 },
      { opacity: 0, offset: 0.26 },
      { transform: "translateX(10%)", opacity: 0 },
    ],
  },
};

/**
 * Whether the page runs on Android (a WebView, or a browser even asking for the
 * desktop site).
 */
export const onAndroid = () =>
  typeof navigator !== "undefined" &&
  ((navigator as { userAgentData?: { platform?: string } }).userAgentData
    ?.platform === "Android" ||
    /Android/i.test(navigator.userAgent));

/**
 * Each platform's own: Android's activity transition on Android, ios elsewhere.
 */
export const defaultAnimate: Animate = () => (onAndroid() ? android : ios);
