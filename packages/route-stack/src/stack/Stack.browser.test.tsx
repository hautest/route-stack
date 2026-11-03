import { describe, expect, test, vi } from "vitest";
import {
  finishSlide,
  hosts,
  lifted,
  pauseSlide,
  recordFrames,
  scrolled,
  scrollsWhenDropping,
  settled,
  slideAt,
  until,
} from "../test/browser";
import {
  SINK,
  at,
  fast,
  logged,
  mount,
  offsetX,
  pageOf,
  progress,
  progressUntilSettled,
  setupStack,
  shown,
} from "../test/stack";
import {
  android,
  defaultAnimate,
  ios,
  material,
} from "../transition/transitions";

setupStack();

let app: ReturnType<typeof mount> | null = null;

describe("Stack", () => {
  test("a push slides both screens as layers, then shows only the new one", async () => {
    app = mount();
    expect(lifted()).toHaveLength(0);

    app.push(at("/post"));
    expect(lifted()).toHaveLength(2);
    // The screen leaving takes nothing; the one arriving takes focus, no taps.
    const [arriving, leaving] = lifted();
    expect(pageOf(arriving!)).toBe(at("/post"));
    expect(leaving!.inert).toBe(true);
    expect(arriving!.inert).toBe(false);
    expect(arriving!.style.pointerEvents).toBe("none");

    await settled();
    expect(lifted()).toHaveLength(0);
    expect(shown().map(pageOf)).toEqual([at("/post")]);
    // The pushed-from screen is kept, hidden.
    expect(hosts()).toHaveLength(2);
  });

  test("dev warns once when an ancestor makes the layers relative to it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      app = mount();
      const wrapper = document.querySelector("[data-stack-root]")!
        .parentElement as HTMLElement;
      wrapper.style.transform = "translateZ(0)";
      app.push(at("/post"));
      await settled();
      app.push(at("/other"));
      await settled();
      const calls = warn.mock.calls.filter(([message]) =>
        String(message).includes("ancestor of the stack"),
      );
      expect(calls).toHaveLength(1);
      expect(String(calls[0]?.[0])).toContain("transform");
      wrapper.style.removeProperty("transform");
    } finally {
      warn.mockRestore();
    }
  });

  // A page's top margin collapsed out of the stack at rest; a lifted (fixed)
  // layer would keep it inside and shift the content by it.
  test("lifting a screen does not move content with a top margin", async () => {
    const style = document.createElement("style");
    style.textContent = "[data-page] { margin-top: 30px }";
    document.head.append(style);
    try {
      app = mount();
      const page = () =>
        document.querySelector(`[data-page="${at("/home")}"]`) as HTMLElement;
      const before = page().getBoundingClientRect().top;
      app.push(at("/post"));
      expect(lifted()).toHaveLength(2);
      expect(page().getBoundingClientRect().top).toBe(before);
      await settled();
    } finally {
      style.remove();
    }
  });

  test("a back returns to the kept screen at its scroll and drops the screen left", async () => {
    app = mount();
    await scrolled(500);
    app.push(at("/post"));
    await settled();
    expect(scrollY).toBe(0);

    await app.back();
    expect(lifted()).toHaveLength(2);
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(500);
    await until(() => hosts().length === 1, "the prune");
  });

  test("progress: off by default; on, a push rises to 1, unset at rest", async () => {
    app = mount();
    app.push(at("/post"));
    expect(await progressUntilSettled()).toEqual([]);
    app.unmount();

    app = mount({ enableProgressCssVar: true });
    app.push(at("/next"));
    const values: number[] = [];
    for (const time of [0.25, 0.5, 0.95]) {
      const before = progress();
      slideAt(time);
      await until(() => progress() !== before, "the progress written");
      values.push(Number(progress()));
    }
    expect(values.every((value, i) => i === 0 || value > values[i - 1]!)).toBe(
      true,
    );
    expect(values.at(-1)).toBeGreaterThan(0.9);
    finishSlide();
    await settled();
    expect(progress()).toBe("");
  });

  test("a navigation without animation during a slide leaves one screen shown", async () => {
    app = mount({
      animate: (_from, to) => (to.endsWith("/plain") ? false : fast),
    });
    app.push(at("/post"));
    expect(lifted()).toHaveLength(2);

    app.push(at("/plain"));
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/plain")]);
  });

  // A slide ending with the window moved drops its layers a frame later: a
  // navigation without animation in that frame changes the screen shown.
  test("a navigation without animation before a late drop leaves one screen shown", async () => {
    app = mount({
      animate: (_from, to) => (to.endsWith("/plain") ? false : fast),
    });
    await scrolled(700);
    app.push(at("/post"));
    pauseSlide();
    scrollTo(0, 300);

    // At the log, not a frame later: the drop is put off by one frame.
    const sinks = globalThis as Record<symbol, unknown>;
    const sink = sinks[SINK] as (event: string) => void;
    const late = new Promise<void>((resolve) => {
      sinks[SINK] = (event: string) => {
        sink(event);
        if (event === "late-scroll") resolve();
      };
    }).finally(() => (sinks[SINK] = sink));
    finishSlide();
    await late;
    app.push(at("/plain"));
    expect(shown().map(pageOf)).toEqual([at("/plain")]);

    await until(() => !lifted().length, "the drop put off");
    expect(shown().map(pageOf)).toEqual([at("/plain")]);
    logged.splice(0); // its late-scroll warning is the point
  });

  // Content in flow above the stack (an app header): the screens start below
  // it, so a layer shows its screen where the window showed it, and does not
  // cover the header while it is in view.
  test("a header above the stack: screens stay in place when lifted and dropped", async () => {
    const header = Object.assign(document.createElement("header"), {
      style: "height: 100px",
    });
    document.body.prepend(header);
    try {
      app = mount();
      await scrolled(500);
      const homePage = () =>
        document.querySelector<HTMLElement>(`[data-page="${at("/home")}"]`)!;
      const before = homePage().getBoundingClientRect().top;

      app.push(at("/post"));
      expect(lifted()).toHaveLength(2);
      expect(homePage().getBoundingClientRect().top).toBe(before);

      await settled();
      await app.back();
      const stop = recordFrames();
      await settled();
      expect(scrollsWhenDropping(stop())).toEqual([]);
      expect(homePage().getBoundingClientRect().top).toBe(before);
      expect(scrollY).toBe(500);

      // Back at the top, the header shows during a slide.
      await scrolled(0);
      app.push(at("/next"));
      const layerTop = Math.min(
        ...lifted().map((host) => host.getBoundingClientRect().top),
      );
      expect(layerTop).toBe(100);
      await settled();
    } finally {
      header.remove();
    }
  });

  // A theme wrapper paints the page, not body or html: a layer without that
  // color flashes white where its screen does not cover it.
  test("a layer takes the page color from the nearest painted ancestor", async () => {
    app = mount();
    const wrapper = document.querySelector("[data-stack-root]")!
      .parentElement as HTMLElement;
    wrapper.style.background = "rgb(20, 20, 20)";

    app.push(at("/post"));
    for (const host of lifted())
      expect(getComputedStyle(host).backgroundColor).toBe("rgb(20, 20, 20)");
    await settled();
  });

  // Screen ids start over on a new mount (HMR, a remounted layout): a scroll
  // saved by the last mount must not land on the new one's screens.
  test("a remounted stack does not restore scrolls saved before", async () => {
    app = mount();
    app.push(at("/old"));
    await settled();
    await scrolled(900);
    app.unmount();

    history.replaceState(null, "", at("/fresh"));
    app = mount();
    await scrolled(0);
    app.push(at("/next"));
    await settled();
    await app.back();
    await settled();
    expect(scrollY).toBe(0);
  });

  // Something else scrolls the window mid-slide (a router's scroll
  // restoration, after the stack's own effect): the end measures, not trusts
  // its aim.
  test("a scroll by someone else during a slide still drops without scrolling", async () => {
    app = mount();
    await scrolled(700);
    app.push(at("/post"));
    pauseSlide();
    scrollTo(0, 300);

    const stop = recordFrames();
    finishSlide();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(0);
    logged.splice(0); // its late-scroll warning is the point
  });

  // The window is aimed at the screen pushed to from the start; a back without
  // animation cutting that slide returns to a kept screen's own scroll.
  test("a back without animation during a slide drops the layers without scrolling", async () => {
    app = mount({
      animate: (_from, _to, direction) => (direction === "back" ? false : fast),
    });
    await scrolled(700);
    app.push(at("/post"));
    slideAt(0.5);

    const stop = recordFrames();
    await app.back();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(700);
  });

  test("animate false switches screens without layers", async () => {
    app = mount({ animate: () => false });
    app.push(at("/post"));
    expect(lifted()).toHaveLength(0);
    expect(shown().map(pageOf)).toEqual([at("/post")]);
  });

  test("a same-pathname replace keeps the screen, a query push is a new one", async () => {
    app = mount();
    app.replace(at("/search?q=a"));
    await settled();
    const search = hosts().find((host) => pageOf(host) === at("/search?q=a"));

    app.replace(at("/search?q=b"));
    expect(lifted()).toHaveLength(0);
    expect(hosts().find((host) => pageOf(host) === at("/search?q=b"))).toBe(
      search,
    );

    app.push(at("/search?q=c"));
    expect(lifted()).toHaveLength(2);
    await settled();
    expect(hosts()).toHaveLength(2);
  });

  test("sameScreen can make a query replace slide a new screen in, in the old one's place", async () => {
    app = mount({
      sameScreen: (from, to) => from.split("#")[0] === to.split("#")[0],
    });
    app.replace(at("/search?q=a"));
    await settled();
    const search = hosts().find((host) => pageOf(host) === at("/search?q=a"));

    app.replace(at("/search?q=b"));
    expect(lifted()).toHaveLength(2);
    await settled();
    await until(() => hosts().length === 1, "the prune");
    expect(hosts()[0]).not.toBe(search);
    expect(shown().map(pageOf)).toEqual([at("/search?q=b")]);
  });

  test("a redirect of the screen being slid to continues the same slide", async () => {
    app = mount();
    app.push(at("/me"));
    app.replace(at("/login"));
    // Still one slide of two layers: the new screen took the entering one's
    // place.
    expect(lifted()).toHaveLength(2);
    expect(lifted().map(pageOf)).not.toContain(at("/me"));
    // And it moves: a copy of a pending animation's start time held it
    // (WebKit). Replaced in the push's task, its animation is still pending.
    const login = lifted().find((host) => pageOf(host) === at("/login"))!;
    const before = offsetX(login);
    await until(() => offsetX(login) < before, "the redirected screen moving");
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/login")]);
  });

  // Turned while it plays (not pending: started a frame before), the slide
  // goes on from where the screen is.
  test("a redirect of a playing slide continues from where it is, without a jump", async () => {
    // The duration only bounds how long it may play; nothing waits on it.
    app = mount({ animate: () => ({ ...ios, duration: 10_000 }) });
    app.push(at("/me"));
    slideAt(0.5);
    for (const animation of document.getAnimations()) animation.play();
    await until(
      () =>
        document
          .getAnimations()
          .every(
            (animation) =>
              !animation.pending && animation.playState === "running",
          ),
      "the slide playing",
    );
    const me = lifted().find((host) => pageOf(host) === at("/me"))!;
    const was = offsetX(me);
    app.replace(at("/login"));
    const login = lifted().find((host) => pageOf(host) === at("/login"))!;
    expect(offsetX(login)).toBeCloseTo(was, 0);
    await until(() => offsetX(login) < was, "the redirected screen moving");
    finishSlide();
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/login")]);
  });

  test("a played slide keeps the keyframes between its ends (material fades through)", async () => {
    app = mount({ animate: () => ({ ...material, duration: 60 }) });
    app.push(at("/post"));
    const counts = lifted().flatMap((host) =>
      host
        .getAnimations()
        .map(
          (animation) =>
            (animation.effect as KeyframeEffect).getKeyframes().length,
        ),
    );
    expect(counts).toEqual([3, 3]);
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/post")]);
  });

  test("the default transition is Android's on Android, ios elsewhere", () => {
    const as = (ua: string) =>
      Object.defineProperty(navigator, "userAgent", {
        value: ua,
        configurable: true,
      });
    try {
      as(
        "Mozilla/5.0 (Linux; Android 15; SM-S921N; wv) AppleWebKit/537.36 " +
          "Chrome/141.0 Mobile Safari/537.36",
      );
      expect(defaultAnimate("/", "/a", "push")).toBe(android);
      as(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) " +
          "AppleWebKit/605.1.15 Mobile/15E148",
      );
      expect(defaultAnimate("/", "/a", "push")).toBe(ios);
    } finally {
      delete (navigator as { userAgent?: string }).userAgent;
    }
  });

  test("a query-only replace mid-slide keeps the slide going to the same screen", async () => {
    app = mount();
    app.push(at("/post"));
    app.replace(at("/post?x=1"));
    expect(lifted()).toHaveLength(2);
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/post?x=1")]);
    expect(hosts()).toHaveLength(2);
  });

  test("a second redirect keeps the entering screen on top", async () => {
    // A shadow, if the transition has one, moves to the new top layer.
    app = mount({ animate: () => ({ ...fast, shadow: "-8px 0 24px #0003" }) });
    app.push(at("/me"));
    app.replace(at("/login"));
    app.replace(at("/onboarding"));
    const top = lifted().find((host) => host.style.zIndex === "2");
    expect(top && pageOf(top)).toBe(at("/onboarding"));
    expect(top?.style.boxShadow).not.toBe("");
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/onboarding")]);
  });
});
