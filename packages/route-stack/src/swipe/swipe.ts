import { claimsDrag } from "./claim";

// A touch starting this close to the left edge swipes whatever is under it,
// as a native edge gesture over a scroll view (stackflow's 1.25rem).
const EDGE = 20;
// How far a finger moves before its direction decides.
const SLOP = 10;
// Release decision: back when the finger covered this share of the way it
// had to the right edge (from mid-screen, 40% of the width is out of reach),
// or its speed over the last moves before the release is above this (px/ms).
// Not the average since the touch began (stackflow): the finger resting before
// a flick drags that down, so flicks did not go back.
const BACK_AT = 0.4;
const BACK_SPEED = 1;
const SPEED_WINDOW_MS = 100;

/** A finger-driven slide. */
export interface Drag {
  /** Progress 0..1 toward the screen behind; called at most once per frame. */
  seek(progress: number): void;
  /** The finger left: go back or stay, from `progress`. */
  release(back: boolean, progress: number): void;
}

/** Where a swipe can start: on the shown screen `host`, at its edge or anywhere. */
export interface SwipeArea {
  host: Element;
  fullScreen: boolean;
}

export interface Swipe {
  /** Where the next touch can start a swipe; null: none can. */
  open(area: SwipeArea | null): void;
  /**
   * Drops a drag without releasing it (its slide was ended by something else).
   */
  forget(): void;
  dispose(): void;
}

// Blocking: WebKit and Chromium then wait for the page before they start a
// scroll, so a swipe decided at the first moves can still cancel them and keep
// the finger (pointer events can't: WebKit cancels the stream on any vertical
// drift). Only between touches: one added mid-touch is not waited for.
const blocking = { passive: false };
const passive = { passive: true, capture: true };
const waitForPage = () => {};

/**
 * Swipe back: touch events, the slide seeked once per frame, the release
 * deciding back or stay at once. A touch is the swipe's once it moved
 * sideways past the slop, unless the browser already scrolls or the page takes
 * the drag (`claimsDrag`). Knows nothing of the stack: `begin` starts the
 * slide, or returns null for no swipe.
 */
export function listenSwipe(begin: () => Drag | null): Swipe {
  let area: SwipeArea | null = null;

  let finger: {
    id: number;
    x0: number;
    y0: number;
    x: number;
    y: number;
    track: [x: number, time: number][];
    target: EventTarget;
    /** Inside a shadow root, the element touched (the target is its host). */
    touched: EventTarget;
    edge: boolean;
    drag: Drag | null;
  } | null = null;

  let frame = 0;

  // The touched element gets the finger's later events, also once removed
  // from the document (a skeleton replaced under the finger), and then they no
  // longer reach the window: listened on it, for this touch.
  const hold = (target: EventTarget, on: boolean) => {
    const method = on ? "addEventListener" : "removeEventListener";
    target[method]("touchmove", onMove as EventListener, blocking);
    target[method]("touchend", onEnd as EventListener);
    target[method]("touchcancel", onCancel as EventListener);
  };

  // The screen follows the finger 1:1.
  const progressAt = (x: number) =>
    Math.min(1, Math.max(0, (x - (finger?.x0 ?? x)) / innerWidth));
  const find = (event: TouchEvent) =>
    finger &&
    [...event.changedTouches].find((point) => point.identifier === finger?.id);

  const release = (back: boolean) => {
    if (!finger) return;

    const { drag, x, target } = finger;
    const progress = progressAt(x);

    hold(target, false);
    finger = null;
    cancelAnimationFrame(frame);
    frame = 0;

    drag?.release(back, progress);
  };

  const seekNextFrame = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      if (finger?.drag) finger.drag.seek(progressAt(finger.x));
    });
  };

  function onStart(event: TouchEvent) {
    // A finger still down from a touch whose end never came (a dialog,
    // backgrounding): release it. A second finger: no swipe (a pinch).
    release(false);

    const touch = event.changedTouches[0];
    const target = event.target;
    if (!area || !touch || !target || event.touches.length > 1) return;

    const edge = touch.clientX <= EDGE;
    // On the shown screen only: a sheet portaled out of it keeps its drags.
    if (
      (!edge && !area.fullScreen) ||
      !(target instanceof Node) ||
      !area.host.contains(target)
    )
      return;

    finger = {
      id: touch.identifier,
      x0: touch.clientX,
      y0: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
      track: [[touch.clientX, event.timeStamp]],
      target,
      touched: event.composedPath()[0] ?? target,
      edge,
      drag: null,
    };
    hold(target, true);
  }

  function onMove(event: TouchEvent) {
    const touch = find(event);
    if (!finger || !touch) return;

    finger.x = touch.clientX;
    finger.y = touch.clientY;
    finger.track.push([touch.clientX, event.timeStamp]);
    if (finger.track.length > 32) finger.track.shift();

    if (finger.drag) {
      if (event.cancelable) event.preventDefault();
      return seekNextFrame();
    }

    const dx = finger.x - finger.x0;
    const dy = finger.y - finger.y0;
    if (Math.hypot(dx, dy) < SLOP) return;
    // Not cancelable: the browser already scrolls (a carousel, the page).
    if (
      !event.cancelable ||
      dx <= Math.abs(dy) ||
      // Pinched in: a drag sideways pans the zoomed page.
      (visualViewport?.scale ?? 1) > 1.01 ||
      !area ||
      claimsDrag(finger.touched, area.host, finger.edge)
    )
      return release(false);

    finger.drag = begin();
    if (!finger.drag) return release(false);
    event.preventDefault();
    seekNextFrame();
  }

  function onEnd(event: TouchEvent) {
    const touch = find(event);
    if (!finger || !touch) return;
    if (!finger.drag) return release(false);

    finger.x = touch.clientX;
    const [x1, time1] = finger.track.find(
      ([, at]) => event.timeStamp - at <= SPEED_WINDOW_MS,
    ) ?? [touch.clientX, event.timeStamp];
    const speed = (touch.clientX - x1) / (event.timeStamp - time1 || 1);
    const room = Math.max(1, innerWidth - finger.x0);

    release((touch.clientX - finger.x0) / room > BACK_AT || speed > BACK_SPEED);
  }

  // The system took the touch (a gesture of its own): stay, wherever the
  // finger is.
  function onCancel(event: TouchEvent) {
    if (find(event)) release(false);
  }

  addEventListener("touchstart", onStart, passive);

  return {
    open(next) {
      if (next && !area) addEventListener("touchmove", waitForPage, blocking);
      if (!next && area) removeEventListener("touchmove", waitForPage);
      area = next;
    },
    forget() {
      if (finger) hold(finger.target, false);
      finger = null;
      cancelAnimationFrame(frame);
      frame = 0;
    },
    dispose() {
      this.forget();
      this.open(null);
      removeEventListener("touchstart", onStart, passive);
    },
  };
}
