// Helpers of the browser tests, kept out of the build (rslib.config.ts).

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
export const frame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));
export const frames = async (count: number) => {
  for (let i = 0; i < count; i++) await frame();
};

export const hosts = () => [
  ...document.querySelectorAll<HTMLElement>("[data-stack-screen]"),
];
export const lifted = () =>
  hosts().filter((host) => host.style.position === "fixed");

// Until no layer is up: the slide ended in settle. Polled, not a fixed wait, so
// a loaded machine does not fail it.
export const settled = async () => {
  const deadline = performance.now() + 3000;
  while (lifted().length) {
    if (performance.now() > deadline)
      throw new Error("the slide did not settle");
    await frame();
  }
  // The re-render that unmounts pruned screens.
  await frame();
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
}

// A plain event carrying the touch points the swipe reads: desktop WebKit
// (the engine of iOS WebViews) constructs neither Touch nor TouchEvent.
export function dispatchTouch(
  target: EventTarget,
  type: string,
  x: number,
  y = 300,
  { cancelable = true, id = 1, fingers = 1 }: TouchOptions = {},
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
  target.dispatchEvent(event);
  return event;
}
