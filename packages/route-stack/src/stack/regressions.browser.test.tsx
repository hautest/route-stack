import { describe, expect, test, vi } from "vitest";
import {
  finishSlide,
  hosts,
  lifted,
  recordFrames,
  scrolled,
  scrollsWhenDropping,
  settled,
  slideAt,
  until,
} from "../test/browser";
import {
  at,
  fast,
  heights,
  mount,
  pageOf,
  setupStack,
  shown,
} from "../test/stack";
import { contentOf } from "../transition/layers";
import { android, ios, material } from "../transition/transitions";

setupStack();

let app: ReturnType<typeof mount> | null = null;

// Each guards a bug met on a device while building the library (see the
// troubleshooting notes).
describe("regressions", () => {
  // Navigations faster than the router renders (/a, /b, /a: only the last
  // rendered): the screen shown at its path shows the current entry. Taken for
  // content still loading, the stack kept /a's first entry as the last one
  // committed, and the next back (to /b) slid as a push.
  test("navigations the router skips past land on the screen shown", async () => {
    app = mount({ view: () => "current" });
    app.push(at("/a"));
    await settled();
    history.pushState(null, "", at("/b"));
    history.pushState(null, "", at("/a"));
    app.render();
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/a")]);

    await app.back();
    // A back: the screen leaving (/a) stays on top, as a push reversed.
    const top = lifted().find((host) => host.style.zIndex === "2");
    expect(top && pageOf(top)).toBe(at("/a"));
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/b")]);
  });

  // A forward traversal mid-back lands on a screen still kept: from its saved
  // scroll, not the top (it jumped at the end).
  test("a forward during a back slides to the kept screen at its saved scroll", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    await scrolled(800);

    await app.back();
    slideAt(0.5);
    const landed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    history.forward();
    await landed;
    const post = lifted().find((host) => pageOf(host) === at("/post"));
    expect(post && contentOf(post).style.marginTop).toBe("-800px");
    // From the window aimed: its move before was mid-slide, not at the drop.
    const stop = recordFrames();
    finishSlide();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(800);
  });

  test("a push to a #fragment opens the new screen at its element", async () => {
    app = mount();
    app.push(at("/doc#sec"));
    const doc = lifted().find((host) => pageOf(host) === at("/doc"))!;
    const marginTop = -parseFloat(contentOf(doc).style.marginTop);
    expect(marginTop).toBeGreaterThan(1000);
    await settled();
    expect(scrollY).toBe(marginTop);
    expect(document.getElementById("sec")!.getBoundingClientRect().top).toBe(0);
  });

  test("a push takes the focus out of the screen left (a keyboard closes)", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    const button = shown()[0]!.querySelector<HTMLElement>("[data-fixed]")!;
    button.focus();
    expect(document.activeElement).toBe(button);
    app.push(at("/next"));
    expect(lifted()).toHaveLength(2);
    expect(lifted().some((host) => host.contains(document.activeElement))).toBe(
      false,
    );
    await settled();
  });

  // A router that refetches on back (React Router loaders) renders the kept
  // screen as a short skeleton: a layer at the saved scroll showed nothing
  // past its end, a white screen.
  test("a screen back shorter than its saved scroll shows its end, not past it", async () => {
    app = mount();
    await scrolled(1500);
    app.push(at("/post"));
    await settled();

    heights.set(at("/home"), 1200);
    await app.back();
    const stop = recordFrames();
    const home = hosts().find((host) => pageOf(host) === at("/home"))!;
    const end = 1200 - innerHeight;
    expect(-parseFloat(contentOf(home).style.marginTop)).toBe(end);
    expect(scrollY).toBe(end);

    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(end);
  });

  test("a screen growing back mid-slide is followed, without a jump at the drop", async () => {
    app = mount();
    await scrolled(1500);
    app.push(at("/post"));
    await settled();

    heights.set(at("/home"), 1200);
    await app.back();
    const stop = recordFrames();
    slideAt(0.5);
    // The data arrives: the kept screen renders at its full height again.
    heights.delete(at("/home"));
    app.render();
    const home = hosts().find((host) => pageOf(host) === at("/home"))!;
    await until(
      () =>
        -parseFloat(contentOf(home).style.marginTop) === 1500 &&
        scrollY === 1500,
      "the screen followed",
    );
    expect(lifted()).toHaveLength(2);

    finishSlide();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(1500);
  });

  test("a back drops the layers only once the window is where the screen sits", async () => {
    app = mount();
    await scrolled(700);
    app.push(at("/post"));
    await settled();
    await app.back();
    const stop = recordFrames();
    // Mid-slide: the window already where the screen arrived at sits.
    expect(lifted()).toHaveLength(2);
    expect(scrollY).toBe(700);
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(700);
  });

  test("a push drops the layers only once the window is at the top", async () => {
    app = mount();
    await scrolled(700);
    app.push(at("/post"));
    const stop = recordFrames();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(0);
  });

  test("an in-screen fixed element stays in place on its screen during a slide", async () => {
    app = mount();
    await scrolled(700);
    const homeButton = () =>
      [...document.querySelectorAll<HTMLElement>("[data-fixed]")].find(
        (button) =>
          button.closest("[data-page]")?.getAttribute("data-page") ===
          at("/home"),
      );
    const before = homeButton()!.getBoundingClientRect();
    app.push(at("/post"));
    slideAt(0.5);
    const during = homeButton()!.getBoundingClientRect();
    // On the lower layer it only moves sideways (the parallax), never off the
    // screen bottom.
    expect(during.top).toBeCloseTo(before.top, 0);
    expect(during.bottom).toBeLessThanOrEqual(innerHeight);
    finishSlide();
    await settled();
  });

  test("a played slide runs the full duration and easing, however short the rest", async () => {
    app = mount();
    app.push(at("/post"));
    const timings = lifted().flatMap((host) =>
      host.getAnimations().map((animation) => animation.effect!.getTiming()),
    );
    expect(timings.length).toBeGreaterThan(0);
    for (const timing of timings)
      expect([timing.duration, timing.easing]).toEqual([
        fast.duration,
        fast.easing,
      ]);
    await settled();
  });

  test("the presets only animate transform and opacity", () => {
    for (const preset of [ios, android, material]) {
      const props = [
        ...preset.enter,
        ...preset.leave,
        ...(preset.shade ?? []),
        ...(preset.back?.enter ?? []),
        ...(preset.back?.leave ?? []),
        ...(preset.back?.shade ?? []),
      ].flatMap((keyframe) => Object.keys(keyframe));
      expect(
        props.filter(
          (property) => !["transform", "opacity", "offset"].includes(property),
        ),
      ).toEqual([]);
    }
  });

  // Effects mount, unmount and mount again; renders run twice.
  test("StrictMode: push, back, scroll restore and prune behave as without it", async () => {
    app = mount({}, { strict: true });
    await scrolled(500);
    app.push(at("/post"));
    expect(lifted()).toHaveLength(2);
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/post")]);
    expect(hosts()).toHaveLength(2);
    expect(scrollY).toBe(0);

    await app.back();
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(500);
    await until(() => hosts().length === 1, "the prune");
    expect(history.scrollRestoration).toBe("manual");
    app.unmount();
    app = null;
    expect(history.scrollRestoration).toBe("auto");
  });

  test("unmounting mid-slide leaves no layer, listener or scroll setting behind", async () => {
    // Touch listeners on the window, added minus removed.
    const listening = new Map<string, number>();
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const count = (spy: typeof add, step: number) => {
      for (const [type] of spy.mock.calls)
        if (type.startsWith("touch"))
          listening.set(type, (listening.get(type) ?? 0) + step);
    };
    try {
      app = mount();
      app.push(at("/post"));
      await settled();
      app.push(at("/other"));
      expect(lifted()).toHaveLength(2);
      app.unmount();
      app = null;
      count(add, 1);
      count(remove, -1);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
    expect([...listening.values()].every((n) => n === 0)).toBe(true);
    expect(listening.get("touchmove")).toBe(0);
    expect(history.scrollRestoration).toBe("auto");
    expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(0);
  });
});
