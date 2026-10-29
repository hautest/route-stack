import type { ReactNode } from "react";

/** Browser forward navigation counts as push. */
export type Direction = "push" | "back" | "replace";

/** The kind of a navigation as a router names it, before history shows it. */
export type NavigationType = "push" | "replace" | "traverse";

/**
 * Defined for push; back plays the same keyframes in reverse, unless `back`
 * defines its own. Animate only `transform` and `opacity`: anything else
 * repaints whole screen layers every frame.
 */
export interface Transition {
  duration: number;
  /**
   * Easing of a played slide (a push, a back, the rest of a swipe after
   * release). A finger follows linearly.
   */
  easing: string;
  enter: Keyframe[];
  leave: Keyframe[];
  /** Keyframes of a translucent layer over the lower screen, to darken it. */
  shade?: Keyframe[];
  /** A fixed `box-shadow` of the upper screen during the slide. */
  shadow?: string;
  /** Whether the entering screen is drawn above the leaving one on push. */
  enterOnTop: boolean;
  /**
   * Back's own keyframes, played forward (a back that is not a push reversed,
   * as Android's): `enter` for the screen coming back, `leave` for the one
   * going, `shade` (none if left out, not the push's) over the lower layer.
   * Same duration and easing; the layers stack as a push reversed. A finger
   * swiping back follows them linearly too.
   */
  back?: Pick<Transition, "enter" | "leave" | "shade">;
}

/**
 * from/to are paths with their query. Returning false switches screens without
 * animation.
 */
export type Animate = (
  from: string,
  to: string,
  direction: Direction,
) => Transition | false;

/**
 * from/to are URLs as the address bar has them, without the origin: pathname,
 * query and #fragment (a base path included). `type` is the navigation's; a
 * back or forward to an entry not seen before is decided as a push.
 */
export type SameScreen = (
  from: string,
  to: string,
  type: "push" | "replace",
) => boolean;

/** Where a swipe back can start: the left edge, anywhere, or nowhere. */
export type SwipeMode = "edge" | "full" | false;

export interface StackProps {
  /**
   * Path of the rendered route with its query; a different value is a different
   * screen.
   */
  path: string;
  animate?: Animate;
  /**
   * Swipe back: from the shown screen's left edge (`"edge"`), from anywhere on
   * it (`"full"`), or not (`false`). Default: `"edge"`, except `false` on
   * Android, whose back is the system's (a button, or a gesture that takes the
   * screen edge anyway). A function decides per back: `from` the path shown,
   * `to` the one a swipe would go back to; `false` lets the touches through to
   * the page.
   *
   * With `"full"`, a touch is the swipe's once it moved 10px mostly sideways,
   * unless the browser already scrolls, a scroller under the finger can scroll
   * back left, an element declares `touch-action` without `pan-x` (a JS
   * carousel's `pan-y`), or a form control or `[data-stack-no-swipe]` is under
   * the finger: a JS gesture without either moves with the swipe.
   */
  swipe?: SwipeMode | ((from: string, to: string) => SwipeMode);
  /**
   * Whether a push or replace stays on the screen shown, the page kept
   * mounted; otherwise it is a new screen. Default: `defaultSameScreen`, a
   * push to the same pathname and query (a #fragment changed only), a replace
   * to the same pathname. Keep it pure: the stack may also ask it about a
   * render's path, which has no #fragment nor base path.
   */
  sameScreen?: SameScreen;
  /**
   * Sets `--route-stack-progress` on the root element every frame of a slide:
   * how far the screen the router renders is in (0 to 1), unset at rest. Off
   * by default: each write restyles the whole document.
   */
  enableProgressCssVar?: boolean;
  children: ReactNode;
}

/**
 * What a render is for the current history entry, as only its router can
 * tell: `current`, its content; `stale`, content the router still shows though
 * history has moved (loaders, segments pending); `held`, the router refuses the
 * entry history went to (a blocker asking); `ahead`, rendered before history
 * has the navigation (Next), with its kind and URL. A traversal has no
 * `ahead`: history has it before any router renders.
 */
export type View =
  | "current"
  | "stale"
  | "held"
  | {
      ahead: Exclude<NavigationType, "traverse">;
      /**
       * The URL it goes to as history will have it: absolute, or without the
       * origin with the base path.
       */
      url: string;
    };

/**
 * What a router adapter tells the stack beyond the path. Not for apps: the
 * adapters for Next, React Router and TanStack Router take `StackProps` only.
 */
export interface AdapterProps {
  /**
   * Read when needed, not once per render: `ahead` as the stack renders,
   * `current` or `stale` at its commit, `held` a frame after a traversal under
   * a swipe back. Not read on the server, where every render is `current`.
   * Default: always `current`, for a path the app reads from the URL as
   * history changes.
   *
   * The adapter re-renders the stack whenever the history entry changes, even
   * to the same path (a guard's redirect back to the screen shown): a commit
   * is how the stack learns that entry is current.
   */
  view?: () => View;
}
