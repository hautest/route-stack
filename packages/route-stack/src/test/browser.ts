// Helpers of the browser tests, kept out of the build (rslib.config.ts).

export const frame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

export const hosts = () => [
  ...document.querySelectorAll<HTMLElement>("[data-stack-screen]"),
];
export const lifted = () =>
  hosts().filter((host) => host.style.position === "fixed");

// Polled each frame until true. The deadline only turns a state that never
// comes into a failure; no test waits on time.
export async function until(ready: () => boolean, what = "the state") {
  const deadline = performance.now() + 5000;
  while (!ready()) {
    if (performance.now() > deadline) throw new Error(`${what} never came`);
    await frame();
  }
}

// Until no layer is up: the slide ended in settle. A prune's re-render comes
// after: a test counting screens waits for them too.
export const settled = () => until(() => !lifted().length, "the settle");

// The window at `y`, its scroll event handled (the stack saves scrolls there:
// its listener came first).
export async function scrolled(y: number) {
  if (Math.round(scrollY) === y) return;
  const at = new Promise<void>((resolve) => {
    const onScroll = () => {
      if (Math.round(scrollY) !== y) return;
      removeEventListener("scroll", onScroll);
      resolve();
    };
    addEventListener("scroll", onScroll);
  });
  scrollTo(0, y);
  await at;
}

// A slide held where it is, for a test acting mid-slide however slow the
// machine; finished, it settles as if played.
export const pauseSlide = () => {
  for (const animation of document.getAnimations()) animation.pause();
};
export const finishSlide = () => {
  for (const animation of document.getAnimations()) animation.finish();
};
export const slideAt = (progress: number) => {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime =
      progress * Number(animation.effect!.getTiming().duration);
  }
};

// Per animation frame: the window scroll and how many layers are up.
export function recordFrames() {
  const samples: { y: number; lifted: number }[] = [];
  let on = true;
  const tick = () => {
    samples.push({ y: Math.round(scrollY), lifted: lifted().length });
    if (on) requestAnimationFrame(tick);
  };
  tick();
  return () => {
    on = false;
    return samples;
  };
}

// The cause of the blank frame on iOS WebKit: the layers dropped and the window
// scrolled in the same frame. The window must already be where the screen sits
// when the layers drop.
export const scrollsWhenDropping = (samples: { y: number; lifted: number }[]) =>
  samples.filter(
    (sample, index) =>
      index > 0 &&
      samples[index - 1]!.lifted > 0 &&
      sample.lifted === 0 &&
      sample.y !== samples[index - 1]!.y,
  );

export interface TouchOptions {
  on?: Element | undefined;
  cancelable?: boolean;
  id?: number;
  fingers?: number;
  // The event's time (ms): the swipe reads its speed from these, so a test
  // gives them rather than waiting.
  at?: number;
}

// A plain event carrying the touch points the swipe reads: desktop WebKit
// (the engine of iOS WebViews) constructs neither Touch nor TouchEvent.
export function dispatchTouch(
  target: EventTarget,
  type: string,
  x: number,
  y = 300,
  { cancelable = true, id = 1, fingers = 1, at }: TouchOptions = {},
) {
  const point = { identifier: id, target, clientX: x, clientY: y };
  const ended = type === "touchend" || type === "touchcancel";
  const event = Object.assign(
    new Event(type, { bubbles: true, cancelable, composed: true }),
    {
      touches: ended ? [] : Array.from({ length: fingers }, () => point),
      changedTouches: [point],
    },
  );
  if (at !== undefined)
    Object.defineProperty(event, "timeStamp", { value: at });
  target.dispatchEvent(event);
  return event;
}
