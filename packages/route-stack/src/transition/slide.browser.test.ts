import { afterEach, describe, expect, test, vi } from "vitest";
import { background } from "./layers";
import { slide, type Layer } from "./slide";
import { android, ios, material } from "./transitions";

const fast = { ...ios, duration: 80 };

// Two screen hosts in a root, as Stack renders them.
function screens() {
  const root = document.createElement("div");
  const host = () => {
    const el = document.createElement("div");
    el.append(
      Object.assign(document.createElement("div"), { style: "height: 2000px" }),
    );
    root.append(el);
    return { host: el, scroll: 0 } satisfies Layer;
  };
  document.body.append(root);
  return { root, enter: host(), leave: host() };
}

const offsetX = (el: HTMLElement) =>
  new DOMMatrix(getComputedStyle(el).transform).m41;

let root: HTMLElement | null = null;
afterEach(() => {
  root?.remove();
  root = null;
});

describe("slide", () => {
  test("plays from where a finger left it to the end", async () => {
    const pair = screens();
    root = pair.root;
    const control = slide(pair.enter, pair.leave, fast, false);
    control.seek(0.5);
    expect(offsetX(pair.enter.host)).toBeCloseTo(innerWidth * 0.5, 0);
    expect(await control.play(true)).toBe(true);
    expect(offsetX(pair.enter.host)).toBeCloseTo(0, 0);
    expect(control.progress).toBe(1);
  });

  test("tells the app's scrollers not to scroll while lifted, and no more after", async () => {
    const pair = screens();
    root = pair.root;
    const overflow = (host: HTMLElement) =>
      getComputedStyle(host.firstElementChild!).getPropertyValue(
        "--route-stack-overflow",
      );
    const control = slide(pair.enter, pair.leave, fast, false);
    expect(overflow(pair.enter.host)).toBe("hidden");
    expect(overflow(pair.leave.host)).toBe("hidden");
    await control.play(true);
    control.end(pair.enter, true);
    expect(overflow(pair.enter.host)).toBe("");
    expect(overflow(pair.leave.host)).toBe("");
  });

  test("a drop put off a frame is pending until that frame", async () => {
    const pair = screens();
    root = pair.root;
    pair.enter.scroll = 300;
    const control = slide(pair.enter, pair.leave, fast, false);
    control.end(pair.enter);
    expect(control.pending).toBe(true);
    await new Promise(requestAnimationFrame);
    expect(control.pending).toBe(false);
  });

  test("a back with its own keyframes plays them forward, a finger following them", async () => {
    const pair = screens();
    root = pair.root;
    const opacity = (el: HTMLElement) => Number(getComputedStyle(el).opacity);
    const ownBack = {
      ...fast,
      back: {
        enter: [
          { transform: "translateX(-10%)" },
          { transform: "translateX(0)" },
        ],
        leave: [
          { transform: "translateX(0)", opacity: 1 },
          { opacity: 0, offset: 0.3 },
          { transform: "translateX(10%)", opacity: 0 },
        ],
      },
    };
    const control = slide(pair.enter, pair.leave, ownBack, true);
    expect(offsetX(pair.enter.host)).toBeCloseTo(-innerWidth * 0.1, 0);
    expect(opacity(pair.leave.host)).toBe(1);
    control.seek(0.5);
    expect(offsetX(pair.enter.host)).toBeCloseTo(-innerWidth * 0.05, 0);
    expect(offsetX(pair.leave.host)).toBeCloseTo(innerWidth * 0.05, 0);
    // Gone early, as defined forward (a push reversed would fade it late).
    expect(opacity(pair.leave.host)).toBe(0);
    expect(await control.play(true)).toBe(true);
    expect(offsetX(pair.enter.host)).toBeCloseTo(0, 0);
    expect(offsetX(pair.leave.host)).toBeCloseTo(innerWidth * 0.1, 0);
  });

  test("a back of its own played from the start keeps its keyframes in order", () => {
    const pair = screens();
    root = pair.root;
    const control = slide(pair.enter, pair.leave, android, true);
    void control.play(true);
    const played = pair.leave.host
      .getAnimations()
      .flatMap((animation) =>
        (animation.effect as KeyframeEffect)
          .getKeyframes()
          .map((keyframe) => +keyframe.computedOffset.toFixed(2)),
      );
    expect(played).toEqual([0, 0.08, 0.26, 1]);
  });

  test("a back without its own keyframes still plays the push reversed", () => {
    const pair = screens();
    root = pair.root;
    const control = slide(pair.enter, pair.leave, fast, true);
    // ios: the screen pushed then (now leaving) starts in place and leaves to
    // 100%; the one coming back starts at -30%.
    expect(offsetX(pair.leave.host)).toBeCloseTo(0, 0);
    expect(offsetX(pair.enter.host)).toBeCloseTo(-innerWidth * 0.3, 0);
    control.seek(1);
    expect(offsetX(pair.leave.host)).toBeCloseTo(innerWidth, 0);
  });

  test("a slide takes the focus from the screen leaving, not the one arriving", () => {
    const pair = screens();
    root = pair.root;
    const field = (host: HTMLElement) =>
      host.firstElementChild!.appendChild(document.createElement("input"));
    const leaving = field(pair.leave.host);
    const arriving = field(pair.enter.host);

    leaving.focus();
    const first = slide(pair.enter, pair.leave, fast, false);
    expect(document.activeElement).not.toBe(leaving);
    first.end(pair.enter, true);

    // An autoFocus of the screen arriving lands before the slide starts.
    arriving.focus();
    slide(pair.enter, pair.leave, fast, false).end(pair.enter, true);
    expect(document.activeElement).toBe(arriving);
  });

  // The core never retargets to the screen leaving: a guard sending the slide
  // there is absorbed instead. Caught in development if that ever breaks.
  test("a retarget to the leaving screen is reported in development", () => {
    const pair = screens();
    root = pair.root;
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const control = slide(pair.enter, pair.leave, fast, false);
      control.retarget(pair.leave);
      expect(report).toHaveBeenCalledTimes(1);
      control.end(pair.leave, true);
    } finally {
      report.mockRestore();
    }
  });

  test("a layer with no painted ancestor takes the page's own color", () => {
    expect(background(document.createElement("div"))).toBe("Canvas");
  });

  test("the rest after a release takes the full duration, however little is left", () => {
    const pair = screens();
    root = pair.root;
    const control = slide(pair.enter, pair.leave, fast, false);
    control.seek(0.95);
    void control.play(true);
    const timings = [pair.enter.host, pair.leave.host].flatMap((host) =>
      host.getAnimations().map((animation) => animation.effect!.getTiming()),
    );
    for (const timing of timings)
      expect([timing.duration, timing.easing]).toEqual([
        fast.duration,
        fast.easing,
      ]);
  });

  test("a second play, turning a running one around, ends exactly at the other end", async () => {
    const pair = screens();
    root = pair.root;
    // Long enough to still be playing when turned, on a loaded machine.
    const control = slide(
      pair.enter,
      pair.leave,
      { ...ios, duration: 600 },
      true,
    );
    control.seek(0.5);
    void control.play(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const turned = control.progress;
    expect(turned).toBeGreaterThan(0.5);
    expect(turned).toBeLessThan(1);
    // Turning around continues from where the screen is, without a jump.
    const before = offsetX(pair.leave.host);
    const turning = control.play(false);
    expect(offsetX(pair.leave.host)).toBeCloseTo(before, -1);
    // Back: the entering (previous) screen is the lower one, the leaving one
    // slides off.
    expect(await turning).toBe(true);
    expect(offsetX(pair.leave.host)).toBeCloseTo(0, 0);
    expect(offsetX(pair.enter.host)).toBeCloseTo(-innerWidth * 0.3, 0);
  });

  test("a play keeps the keyframes between its ends at their progress (back reversed)", () => {
    const pair = screens();
    root = pair.root;
    const control = slide(pair.enter, pair.leave, material, true);
    void control.play(true);
    // Back: the leaving screen plays material.enter reversed, so its fade (0
    // until 35%) ends at 65%.
    const [frames] = pair.leave.host
      .getAnimations()
      .map((animation) => (animation.effect as KeyframeEffect).getKeyframes());
    expect(
      frames?.map((keyframe) => [keyframe.offset, Number(keyframe.opacity)]),
    ).toEqual([
      [0, 1],
      [expect.closeTo(0.65, 5), 0],
      [1, 0],
    ]);
  });
});
