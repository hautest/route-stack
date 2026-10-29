import type { Transition } from "../types";

const META = new Set(["offset", "computedOffset", "easing", "composite"]);

export interface Track {
  el: Element;
  keyframes: Keyframe[];
}

/**
 * The animations of one slide. Each track's keyframes map to progress linearly
 * (`reversed`: a back playing push keyframes): a finger seeks them held paused,
 * and a play samples them. `tracks`: the screen the keyframes bring in, the one
 * they take out, then any others.
 */
export function motionOf(
  tracks: Track[],
  transition: Transition,
  reversed: boolean,
) {
  // The entering layer's track, which retarget() swaps: the other layer's
  // animation is the clock.
  const enterIndex = reversed ? 1 : 0;

  const linear: KeyframeAnimationOptions = {
    duration: transition.duration,
    easing: "linear",
    fill: "both",
    direction: reversed ? "reverse" : "normal",
  };

  const hold = (track: Track, progress: number) => {
    const animation = track.el.animate(track.keyframes, linear);
    animation.pause();
    animation.currentTime = progress * transition.duration;
    return animation;
  };

  let animations = tracks.map((track) => hold(track, 0));
  const effect = (animation: Animation) => animation.effect as KeyframeEffect;
  const clock = () => animations[1 - enterIndex] as Animation;

  let at = 0; // the progress shown, or played to
  let playing: { from: number; to: number } | null = null;

  const motion = {
    /** 0: the leaving screen in place, 1: the entering one. */
    get progress() {
      if (!playing) return at;

      const { from, to } = playing;
      // A play's keyframes are placed linearly in progress, so its eased
      // progress maps back.
      return (
        from + (to - from) * (effect(clock()).getComputedTiming().progress ?? 0)
      );
    },
    seek(progress: number) {
      if (playing) {
        for (const animation of animations) animation.cancel();
        animations = tracks.map((track) => hold(track, progress));
        playing = null;
      } else
        for (const animation of animations)
          animation.currentTime = progress * transition.duration;

      at = progress;
    },
    /**
     * Plays to `to` (0 or 1) from where it is; null if already there. Gives
     * whether, once finished, it is still the current play (none replaced it),
     * or null if it was cancelled.
     */
    play(to: number): Promise<boolean | null> | null {
      const from = motion.progress;
      if (from === to) return null;

      // Plays not the tracks (a negative playbackRate toward 0 finishes at once
      // in iOS WebKit) but from what the screen shows now to what it shows at
      // the end, through the keyframes between (a fade that ends early stays
      // so), each sampled from a held track at its progress.
      animations = tracks.map((track, i) => {
        const keyframes = new KeyframeEffect(
          null,
          track.keyframes,
          linear,
        ).getKeyframes();
        const props = [
          ...new Set(keyframes.flatMap((keyframe) => Object.keys(keyframe))),
        ].filter((property) => !META.has(property));

        const read = () => {
          const style = getComputedStyle(track.el) as unknown as Record<
            string,
            string
          >;
          return Object.fromEntries(
            props.map((property) => [property, style[property] ?? ""]),
          );
        };

        const frame = (progress: number) => {
          const probe = hold(track, progress);
          const values = read();
          probe.cancel();
          return { ...values, offset: (progress - from) / (to - from) };
        };

        // A play turning a running one around starts from what the screen
        // shows, read as is: its progress is only an estimate (engines differ
        // on an eased animation's computed progress).
        const start = playing ? { ...read(), offset: 0 } : frame(from);
        const between = keyframes
          .map((keyframe) =>
            reversed ? 1 - keyframe.computedOffset : keyframe.computedOffset,
          )
          .filter((progress) => (progress - from) * (progress - to) < 0)
          .sort((first, second) => (first - second) * (to - from));

        const next = track.el.animate(
          [start, ...between.map(frame), frame(to)],
          {
            duration: transition.duration,
            easing: transition.easing,
            fill: "both",
          },
        );

        animations[i]?.cancel();
        return next;
      });

      playing = { from, to };
      at = to;

      const clocked = clock();
      return clocked.finished.then(
        () => clock() === clocked,
        () => null,
      );
    },
    /** The entering track moves to `host`, at the same keyframes and time. */
    retarget(host: HTMLElement) {
      const old = animations[enterIndex] as Animation;
      const next = host.animate(
        effect(old).getKeyframes(),
        effect(old).getTiming(),
      );
      // Not startTime: it is null while the old animation is still pending
      // (WebKit), which holds the new one.
      if (old.playState === "paused") next.pause();
      next.currentTime = old.currentTime;
      old.cancel();

      animations[enterIndex] = next;
      (tracks[enterIndex] as Track).el = host;
    },
    pause() {
      for (const animation of animations) animation.pause();
    },
    cancel() {
      for (const animation of animations) animation.cancel();
    },
  };

  return motion;
}
