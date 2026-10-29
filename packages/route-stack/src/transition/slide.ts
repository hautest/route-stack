import { dev, log } from "../log";
import type { Transition } from "../types";
import { aimOf } from "./aim";
import {
  background,
  contentOf,
  geometryOf,
  layersOf,
  type Layer,
  warnFixedContainer,
} from "./layers";
import { motionOf, type Track } from "./motion";

export type { Layer } from "./layers";

export type Side = "enter" | "leave";

export interface SlideControl {
  readonly ended: boolean;
  /** Ended with its drop put off a frame, not run yet. */
  readonly pending: boolean;
  /**
   * 0: the leaving screen in place, 1: the entering one, whichever direction.
   */
  readonly progress: number;
  /** Shows a progress (linear: a finger follows it). */
  seek(progress: number): void;
  /**
   * Plays to one end over the full duration with the easing, whatever the
   * distance left (as a CSS transition would). True once it rests there, false
   * if the slide was ended first.
   */
  play(forward: boolean): Promise<boolean>;
  /** Scrolls the window, behind the layers, to where that screen sits. */
  aim(side: Side): void;
  /**
   * The entering screen was replaced (a redirect): the new one takes its place
   * at the same progress.
   */
  retarget(layer: Layer): void;
  /**
   * Shows both layers' content again after a router commit hid the leaving
   * one's.
   */
  reveal(): void;
  /**
   * Drops the layers: `current`, the screen to show (a layer or not), stays
   * shown, the others hidden. The window is put at its scroll first, behind
   * the layers, and they drop the next frame if it moved. `now`: another slide
   * lifts the same hosts right after, and aims the window itself.
   */
  end(current: Layer | null, now?: boolean): void;
}

/**
 * One slide between two screen hosts, lifted as layers (layers.ts), the window
 * aimed behind them (aim.ts), their keyframes played (motion.ts). Back plays
 * `transition.back` forward, or else the push keyframes reversed: the screen
 * pushed then (now leaving) takes `transition.enter`.
 */
export function slide(
  enter: Layer,
  leave: Layer,
  transition: Transition,
  back: boolean,
): SlideControl {
  const owner = {};
  const root = enter.host.parentElement as HTMLElement;
  if (dev) warnFixedContainer(root);
  const geometry = geometryOf(root);
  const { offsetOf } = geometry;
  const { show, place, lift, restore } = layersOf(
    owner,
    background(root),
    geometry,
  );
  const aim = aimOf(root, owner, offsetOf);

  const pushIn = back ? leave : enter;
  const pushOut = back ? enter : leave;
  const top = transition.enterOnTop ? pushIn : pushOut;
  const bottom = transition.enterOnTop ? pushOut : pushIn;

  // Not `enter === top`: retarget() replaces the entering layer.
  const enterOnTop = top === enter;

  // Both shown (a hidden screen measures 0), every read, then the writes:
  // one layout, not one per layer and one more for the aim.
  show(bottom);
  show(top);
  const bottomOffset = offsetOf(bottom);
  const topOffset = offsetOf(top);
  const leaveHeight = contentOf(leave.host).offsetHeight;

  lift(bottom, 1, bottomOffset);
  lift(top, 2, topOffset);
  // Fixed, not animated: an animated shadow repaints the whole layer every
  // frame.
  if (transition.shadow) top.host.style.boxShadow = transition.shadow;

  aim.at(leave, leaveHeight, leave === top ? topOffset : bottomOffset);

  // inert keeps the focus where it was: a field left keeps its keyboard up.
  // Only the screen leaving: one arriving may have just focused a field.
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && leave.host.contains(focused))
    focused.blur();

  // A layer's content can change height while lifted (its data arrives): its
  // offset and, behind the layers, the window follow in the same frame, so the
  // drop finds the window already there.
  // All reads first, then the writes: one layout, not one per layer.
  const resized = new ResizeObserver(() => {
    const layers = [enter, leave];
    const offsets = layers.map(offsetOf);
    const aimed = aim.aimed && {
      layer: aim.aimed,
      height: contentOf(aim.aimed.host).offsetHeight,
      offset: offsetOf(aim.aimed),
    };

    layers.forEach((layer, i) => place(layer, offsets[i]));
    if (aimed) aim.at(aimed.layer, aimed.height, aimed.offset);
  });
  for (const { host } of [enter, leave]) resized.observe(contentOf(host));

  // A back of its own plays forward; else a back plays the push reversed.
  const reversed = back && !transition.back;
  const keyframes = (back && transition.back) || transition;
  // The keyframes bring in `first` and take out `second`.
  const [first, second] = reversed ? [leave, enter] : [enter, leave];

  const shade = keyframes.shade && document.createElement("div");
  if (shade) {
    Object.assign(shade.style, {
      position: "absolute",
      inset: "0",
      background: "#000",
      pointerEvents: "none",
      zIndex: "2147483647",
    });
    bottom.host.append(shade);
  }

  const tracks: Track[] = [
    { el: first.host, keyframes: keyframes.enter },
    { el: second.host, keyframes: keyframes.leave },
    ...(shade && keyframes.shade
      ? [{ el: shade, keyframes: keyframes.shade }]
      : []),
  ];
  const motion = motionOf(tracks, transition, reversed);

  let ended = false;
  let rested = false; // a play reached its end
  let deferred = 0; // the frame of a drop put off

  return {
    get ended() {
      return ended;
    },
    get pending() {
      return deferred !== 0;
    },
    get progress() {
      return motion.progress;
    },
    seek(progress) {
      motion.seek(progress);
    },
    play(forward) {
      if (ended) return Promise.resolve(false);

      const played = motion.play(forward ? 1 : 0);
      if (!played) return Promise.resolve(true);

      return played.then((current) =>
        current === null ? false : (rested = !ended && current),
      );
    },
    aim(side) {
      const layer = side === "leave" ? leave : enter;
      if (!ended && aim.aimed !== layer) aim.at(layer);
    },
    retarget(layer) {
      if (ended) return;
      // The core absorbs a redirect to the screen leaving instead.
      if (dev && layer.host === leave.host)
        console.error("route-stack: a slide retargeted to its leaving screen.");

      lift(layer, enterOnTop ? 2 : 1);
      if (enterOnTop && transition.shadow)
        layer.host.style.boxShadow = transition.shadow;
      if (aim.aimed === enter) aim.at(layer);

      motion.retarget(layer.host);

      restore(enter.host, false);
      resized.unobserve(contentOf(enter.host));
      resized.observe(contentOf(layer.host));
      if (shade && !enterOnTop) layer.host.append(shade);

      enter = layer;
    },
    reveal() {
      if (ended) return;
      contentOf(enter.host).style.removeProperty("display");
      contentOf(leave.host).style.removeProperty("display");
    },
    end(current, now = false) {
      // Ended with its drop still put off: which screen is shown may have
      // changed since (a navigation without animation in that frame), so the
      // drop is decided again with this `current`.
      if (ended && !deferred) return;

      ended = true;
      resized.disconnect();
      cancelAnimationFrame(deferred);
      deferred = 0;

      const drop = () => {
        deferred = 0;
        motion.cancel();
        shade?.remove();
        for (const { host } of [enter, leave])
          restore(host, host === current?.host);
        aim.release();
      };

      // Measured, not assumed: anything may have scrolled the window since it
      // was aimed (a router's scroll restoration).
      if (
        now ||
        !current ||
        Math.round(scrollY) === Math.round(offsetOf(current))
      )
        return drop();

      // A slide played to its end aims the window first: logged, so a blank
      // frame can be traced to it. A slide cut by a navigation without
      // animation is the expected case.
      if (rested) log("late-scroll", { scrollY, want: offsetOf(current) });
      motion.pause();
      aim.at(current);
      deferred = requestAnimationFrame(drop);
    },
  };
}
