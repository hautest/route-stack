import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { Stack } from "./Stack";
import {
  android,
  defaultAnimate,
  ios,
  material,
} from "../transition/transitions";
import type { AdapterProps, StackProps, Transition } from "../types";

const fast: Transition = { ...ios, duration: 60 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Page height by path, for pages whose content changes height (a refetch
// shows a shorter skeleton).
const heights = new Map<string, number>();

// A path the router still renders though history has moved (its loaders
// pending), or null: it renders the URL.
let stale: string | null = null;

// A minimal router: history is the source, the stack renders whatever the URL
// says.
function mount(
  props: Partial<StackProps & AdapterProps> = {},
  { strict = false } = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = stale ?? location.pathname + location.search;
    const page = (
      <div
        style={{ height: `${heights.get(path) ?? 3000}px` }}
        data-page={path}
      >
        {path}
        {/* An in-screen floating button, as moa's "+ 글쓰기". */}
        <button
          data-fixed=""
          style={{ position: "fixed", right: "20px", bottom: "100px" }}
        >
          +
        </button>
        {/* A section a #fragment can land on. */}
        <div id="sec" style={{ marginTop: "1200px" }} />
      </div>
    );
    const stack = (
      <Stack animate={() => fast} {...props} path={path}>
        {page}
      </Stack>
    );
    flushSync(() =>
      root.render(strict ? <StrictMode>{stack}</StrictMode> : stack),
    );
  };
  const onPop = () => render();
  addEventListener("popstate", onPop);
  render();
  return {
    render,
    push(path: string) {
      history.pushState(null, "", path);
      render();
    },
    replace(path: string) {
      history.replaceState(null, "", path);
      render();
    },
    async back() {
      const landed = new Promise((resolve) =>
        addEventListener("popstate", resolve, { once: true }),
      );
      history.back();
      await landed;
    },
    unmount() {
      removeEventListener("popstate", onPop);
      root.unmount();
      container.remove();
    },
  };
}

// Until no layer is up: the slide ended in settle. Polled, not a fixed wait, so
// a loaded machine does not fail it.
const settled = async () => {
  const deadline = performance.now() + 3000;
  while (lifted().length) {
    if (performance.now() > deadline)
      throw new Error("the slide did not settle");
    await frame();
  }
  // The re-render that unmounts pruned screens.
  await frame();
};

const hosts = () => [
  ...document.querySelectorAll<HTMLElement>("[data-stack-screen]"),
];
const lifted = () => hosts().filter((host) => host.style.position === "fixed");
const contentOf = (host: HTMLElement) => host.firstElementChild as HTMLElement;
// React hides a screen's content; the screen element itself is the layer.
const shown = () =>
  hosts().filter(
    (host) => getComputedStyle(contentOf(host)).display !== "none",
  );
const offsetX = (el: HTMLElement) =>
  new DOMMatrix(getComputedStyle(el).transform).m41;
const pageOf = (host: HTMLElement) =>
  host.querySelector("[data-page]")?.getAttribute("data-page");

const progress = () =>
  document.documentElement.style.getPropertyValue("--route-stack-progress");

// The progress at every frame until the slide settles, unset ones left out.
async function progressUntilSettled() {
  const values: number[] = [];
  while (lifted().length) {
    if (progress()) values.push(Number(progress()));
    await frame();
  }
  return values;
}

let app: ReturnType<typeof mount> | null = null;
let base = "";
let run = 0;
const at = (path: string) => `${base}${path}`;

// Per animation frame: the window scroll and how many layers are up.
function recordFrames() {
  const frames: { y: number; lifted: number }[] = [];
  let on = true;
  const tick = () => {
    frames.push({ y: Math.round(scrollY), lifted: lifted().length });
    if (on) requestAnimationFrame(tick);
  };
  tick();
  return () => {
    on = false;
    return frames;
  };
}

// The cause of the blank frame on iOS WebKit: the layers dropped and the window
// scrolled in the same frame. The window must already be where the screen sits
// when the layers drop.
const scrollsWhenDropping = (frames: { y: number; lifted: number }[]) =>
  frames.filter(
    (sample, index) =>
      index > 0 &&
      frames[index - 1]!.lifted > 0 &&
      sample.lifted === 0 &&
      sample.y !== frames[index - 1]!.y,
  );

// Every play must run forward: a negative playbackRate (or reverse()) finishes
// at once in iOS WebKit, so a cancel snapped back without sliding.
const negativeRates: number[] = [];
const rate = Object.getOwnPropertyDescriptor(
  Animation.prototype,
  "playbackRate",
)!;
const updateRate = Animation.prototype.updatePlaybackRate;
const reverse = Animation.prototype.reverse;
beforeAll(() => {
  Object.defineProperty(Animation.prototype, "playbackRate", {
    ...rate,
    set(value: number) {
      if (value < 0) negativeRates.push(value);
      rate.set!.call(this, value);
    },
  });
  Animation.prototype.updatePlaybackRate = function (value) {
    if (value < 0) negativeRates.push(value);
    updateRate.call(this, value);
  };
  Animation.prototype.reverse = function () {
    negativeRates.push(-1);
    reverse.call(this);
  };
});
afterAll(() => {
  Object.defineProperty(Animation.prototype, "playbackRate", rate);
  Animation.prototype.updatePlaybackRate = updateRate;
  Animation.prototype.reverse = reverse;
});
// The window aimed only at the end (late-scroll) is the fallback that still
// blanked on an iPhone: a slide must never need it.
const logged: string[] = [];
const SINK = Symbol.for("route-stack.log");
beforeAll(() => {
  (globalThis as Record<symbol, unknown>)[SINK] = (event: string) =>
    logged.push(event);
});
afterAll(() => {
  delete (globalThis as Record<symbol, unknown>)[SINK];
});
afterEach(() => {
  // Cleared before asserting: a failure here must not fail every test after.
  const rates = negativeRates.splice(0);
  const late = logged.splice(0).filter((event) => event === "late-scroll");
  expect(rates).toEqual([]);
  expect(late).toEqual([]);
});

beforeEach(() => {
  base = `/stack-${++run}`;
  history.replaceState(null, "", at("/home"));
});

afterEach(() => {
  heights.clear();
  app?.unmount();
  app = null;
  scrollTo(0, 0);
});

describe("Stack", () => {
  test("a push slides both screens as layers, then shows only the new one", async () => {
    app = mount();
    expect(lifted()).toHaveLength(0);

    app.push(at("/post"));
    expect(lifted()).toHaveLength(2);
    expect(lifted().every((host) => host.inert)).toBe(true);

    await settled();
    expect(lifted()).toHaveLength(0);
    expect(shown().map(pageOf)).toEqual([at("/post")]);
    // The pushed-from screen is kept, hidden.
    expect(hosts()).toHaveLength(2);
  });

  // A page's top margin collapsed out of the stack at rest; a lifted (fixed)
  // layer would keep it inside and shift the content by it.
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
    scrollTo(0, 500);
    await frame();
    app.push(at("/post"));
    await settled();
    expect(scrollY).toBe(0);

    await app.back();
    expect(lifted()).toHaveLength(2);
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(500);
    expect(hosts()).toHaveLength(1);
  });

  test("the window is aimed at the screen arrived at before the layers drop", async () => {
    app = mount();
    scrollTo(0, 500);
    await frame();
    app.push(at("/post"));
    await settled();

    await app.back();
    // Mid-slide: the layers are still up, the window already where the home
    // screen sits.
    expect(lifted()).toHaveLength(2);
    expect(scrollY).toBe(500);
  });

  test("progress: off by default; on, a push rises to 1, unset at rest", async () => {
    app = mount();
    app.push(at("/post"));
    expect(await progressUntilSettled()).toEqual([]);
    app.unmount();

    // Long enough for several frames: 60ms gave WebKit two.
    app = mount({
      enableProgressCssVar: true,
      animate: () => ({ ...fast, duration: 300 }),
    });
    app.push(at("/next"));
    const values = await progressUntilSettled();
    expect(values.length).toBeGreaterThan(2);
    expect(values.every((value, i) => i === 0 || value >= values[i - 1]!)).toBe(
      true,
    );
    expect(values.at(-1)).toBeGreaterThan(0.9);
    expect(progress()).toBe("");
  });

  test("a navigation without animation during a slide leaves one screen shown", async () => {
    app = mount({
      animate: (_from, to) =>
        to.endsWith("/plain") ? false : { ...fast, duration: 300 },
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
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await frame();
    scrollTo(0, 300);

    // At the log, not a frame later: the drop is put off by one frame.
    const sinks = globalThis as Record<symbol, unknown>;
    const sink = sinks[SINK] as (event: string) => void;
    await new Promise<void>((resolve) => {
      sinks[SINK] = (event: string) => {
        sink(event);
        if (event === "late-scroll") resolve();
      };
    }).finally(() => (sinks[SINK] = sink));
    app.push(at("/plain"));
    expect(shown().map(pageOf)).toEqual([at("/plain")]);

    for (let i = 0; i < 4; i++) await frame();
    expect(lifted()).toHaveLength(0);
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
      app = mount({ animate: () => ({ ...fast, duration: 200 }) });
      scrollTo(0, 500);
      await frame();
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
      scrollTo(0, 0);
      await frame();
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
    scrollTo(0, 900);
    await frame();
    await frame();
    app.unmount();

    history.replaceState(null, "", at("/fresh"));
    app = mount();
    scrollTo(0, 0);
    await frame();
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
    app = mount({ animate: () => ({ ...fast, duration: 200 }) });
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await frame();
    scrollTo(0, 300);

    const stop = recordFrames();
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(0);
    logged.splice(0); // its late-scroll warning is the point
  });

  // The window is aimed at the screen pushed to from the start; a back without
  // animation cutting that slide returns to a kept screen's own scroll.
  test("a back without animation during a slide drops the layers without scrolling", async () => {
    app = mount({
      animate: (_from, _to, direction) =>
        direction === "back" ? false : { ...fast, duration: 300 },
    });
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await frame();

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
    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]).not.toBe(search);
    expect(shown().map(pageOf)).toEqual([at("/search?q=b")]);
  });

  test("a redirect of the screen being slid to continues the same slide", async () => {
    app = mount({ animate: () => ({ ...fast, duration: 300 }) });
    app.push(at("/me"));
    await frame();
    app.replace(at("/login"));
    // Still one slide of two layers: the new screen took the entering one's
    // place.
    expect(lifted()).toHaveLength(2);
    expect(lifted().map(pageOf)).not.toContain(at("/me"));
    // And it moves: a copy of a pending animation's start time held it
    // (WebKit).
    const login = lifted().find((host) => pageOf(host) === at("/login"))!;
    const before = offsetX(login);
    await frame();
    await frame();
    expect(offsetX(login)).toBeLessThan(before);
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
    app = mount({ animate: () => ({ ...fast, duration: 300 }) });
    app.push(at("/post"));
    await settled();
    scrollTo(0, 800);
    await frame();
    await frame();

    const stop = recordFrames();
    await app.back();
    await frame();
    const landed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    history.forward();
    await landed;
    const post = lifted().find((host) => pageOf(host) === at("/post"));
    expect(post && contentOf(post).style.marginTop).toBe("-800px");
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
    scrollTo(0, 1500);
    await frame();
    app.push(at("/post"));
    await settled();

    heights.set(at("/home"), 1200);
    const stop = recordFrames();
    await app.back();
    const home = hosts().find((host) => pageOf(host) === at("/home"))!;
    const end = 1200 - innerHeight;
    expect(-parseFloat(contentOf(home).style.marginTop)).toBe(end);
    expect(scrollY).toBe(end);

    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(end);
  });

  test("a screen growing back mid-slide is followed, without a jump at the drop", async () => {
    // Long enough to still be sliding when the data arrives.
    app = mount({ animate: () => ({ ...fast, duration: 400 }) });
    scrollTo(0, 1500);
    await frame();
    app.push(at("/post"));
    await settled();

    heights.set(at("/home"), 1200);
    const stop = recordFrames();
    await app.back();
    await frame();
    // The data arrives: the kept screen renders at its full height again.
    heights.delete(at("/home"));
    app.render();
    await frame();
    const home = hosts().find((host) => pageOf(host) === at("/home"))!;
    expect(lifted()).toHaveLength(2);
    expect(-parseFloat(contentOf(home).style.marginTop)).toBe(1500);
    expect(scrollY).toBe(1500);

    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(1500);
  });

  test("a back drops the layers only once the window is where the screen sits", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await settled();
    const stop = recordFrames();
    await app.back();
    await settled();
    const frames = stop();
    expect(frames.some((sample) => sample.lifted === 2)).toBe(true);
    expect(scrollsWhenDropping(frames)).toEqual([]);
    expect(scrollY).toBe(700);
  });

  test("a push drops the layers only once the window is at the top", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    const stop = recordFrames();
    app.push(at("/post"));
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(0);
  });

  test("an in-screen fixed element stays in place on its screen during a slide", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    const homeButton = () =>
      [...document.querySelectorAll<HTMLElement>("[data-fixed]")].find(
        (button) =>
          button.closest("[data-page]")?.getAttribute("data-page") ===
          at("/home"),
      );
    const before = homeButton()!.getBoundingClientRect();
    app.push(at("/post"));
    await frame();
    const during = homeButton()!.getBoundingClientRect();
    // On the lower layer it only moves sideways (the parallax), never off the
    // screen bottom.
    expect(during.top).toBeCloseTo(before.top, 0);
    expect(during.bottom).toBeLessThanOrEqual(innerHeight);
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
    scrollTo(0, 500);
    await frame();
    await frame();
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
    expect(hosts()).toHaveLength(1);
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

interface TouchOptions {
  on?: Element | undefined;
  cancelable?: boolean;
  id?: number;
  fingers?: number;
}

// A plain event carrying the touch points the swipe reads: desktop WebKit
// (the engine of iOS WebViews) constructs neither Touch nor TouchEvent.
function dispatchTouch(
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

const page = () =>
  document.querySelector<HTMLElement>(`[data-page="${location.pathname}"]`)!;

describe("edge swipe", () => {
  // On the shown page, the target of all the touch's events, as a browser.
  let target: Element | null = null;
  const touch = (type: string, x: number) => {
    if (type === "touchstart") target = page();
    if (!target) throw new Error("no touch started");
    dispatchTouch(target, type, x);
  };
  const drag = async (to: number, steps = 6) => {
    touch("touchstart", 5);
    for (let i = 1; i <= steps; i++) {
      touch("touchmove", 5 + ((to - 5) * i) / steps);
      await frame();
    }
  };

  test("a swipe starts only with a screen to go back to", async () => {
    app = mount();
    await drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.6);

    app.push(at("/post"));
    await settled();
    await drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.6);
    await settled();
  });

  test("past the edge, a touch is the page's with swipe 'edge'", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    touch("touchstart", 100);
    for (const x of [130, 200, 300]) {
      touch("touchmove", x);
      await frame();
    }
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300);
  });

  test("a short, slow drag released cancels", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    await drag(60);
    expect(lifted()).toHaveLength(2);
    await wait(150);
    touch("touchend", 60);
    await settled();
    expect(location.pathname).toBe(at("/post"));
    expect(lifted()).toHaveLength(0);
    expect(shown().map(pageOf)).toEqual([at("/post")]);
  });

  test("a drag past 40% released goes back", async () => {
    app = mount();
    scrollTo(0, 500);
    await frame();
    app.push(at("/post"));
    await settled();

    await drag(innerWidth * 0.6);
    await wait(150);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/home"));
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(500);
  });

  test("a quick flick goes back even short of 40%", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    touch("touchstart", 5);
    touch("touchmove", 40);
    await frame();
    touch("touchmove", 120);
    touch("touchend", 120);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("ten cancels in a row leave the page and the swipe as they were", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    for (let i = 0; i < 10; i++) {
      await drag(40 + i * 8);
      await wait(150);
      touch("touchend", 40 + i * 8);
      await settled();
      expect(location.pathname).toBe(at("/post"));
    }
    await drag(innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  // Speed is the last moves, not the average since the touch began.
  test("a finger resting before a flick still goes back", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    touch("touchstart", 5);
    await wait(250);
    touch("touchmove", 15);
    await frame();
    touch("touchmove", 110);
    touch("touchend", 110);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("a drag that stops before the release stays (no speed left)", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    await drag(120);
    await wait(200);
    touch("touchend", 120);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a touch the system takes (touchcancel) stays, wherever the finger is", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    await drag(innerWidth * 0.7);
    touch("touchcancel", innerWidth * 0.7);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a swipe right after a push settles works", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    await drag(innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("swipe as a function turns the edge off for the backs it refuses", async () => {
    app = mount({ swipe: (from) => (from.endsWith("/post") ? false : "edge") });
    app.push(at("/post"));
    await settled();
    await drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.6);

    app.push(at("/other"));
    await settled();
    await drag(innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  // Whichever end the release decides, the window is already at the nearer
  // screen: aimed only at the end, a cancel's scroll met the drop (a blank
  // frame on iOS).
  test("the window follows the finger's nearer screen while dragging", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await settled();
    expect(scrollY).toBe(0);

    await drag(innerWidth * 0.7);
    expect(scrollY).toBe(700);
    for (let x = innerWidth * 0.7; x >= innerWidth * 0.3; x -= 40) {
      touch("touchmove", x);
      await frame();
    }
    expect(scrollY).toBe(0);
    await wait(150);
    touch("touchend", innerWidth * 0.3);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a navigation while the finger is down ends the swipe on it, the touch then ignored", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    await drag(innerWidth * 0.5);
    app.push(at("/other"));
    touch("touchmove", innerWidth * 0.6);
    await frame();
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/other"));
    expect(shown().map(pageOf)).toEqual([at("/other")]);
  });

  test("a swipe dragged back to the edge drops the layers without scrolling", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await settled();
    const stop = recordFrames();
    await drag(innerWidth * 0.7);
    for (let x = innerWidth * 0.7; x > 5; x -= 40) {
      touch("touchmove", x);
      await frame();
    }
    touch("touchmove", 5);
    await frame();
    await wait(150);
    touch("touchend", 5);
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(location.pathname).toBe(at("/post"));
  });

  test("a swipe back released past half drops the layers without scrolling", async () => {
    app = mount();
    scrollTo(0, 700);
    await frame();
    app.push(at("/post"));
    await settled();
    const stop = recordFrames();
    await drag(innerWidth * 0.6);
    await wait(150);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(700);
  });

  test("progress falls with the finger, rises once the back commits", async () => {
    app = mount({ enableProgressCssVar: true });
    app.push(at("/post"));
    await settled();

    touch("touchstart", 5);
    touch("touchmove", innerWidth * 0.3);
    await frame();
    // The router still renders /post, about a third of it slid out.
    expect(Number(progress())).toBeCloseTo(0.7, 1);

    touch("touchmove", innerWidth * 0.6);
    await frame();
    await wait(150);
    const committed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    touch("touchend", innerWidth * 0.6);
    await committed;
    const values = await progressUntilSettled();
    // The router renders /home now, more than half in.
    expect(values.every((value) => value >= 0.5)).toBe(true);
    expect(progress()).toBe("");
  });

  // The router's commit of the back lands mid-play, and React hides the screen
  // left. Hiding the element whose animation runs makes iOS WebKit rebuild that
  // animation: the leaving screen jumped back and held two frames.
  test("a back committed mid-play never hides a sliding layer", async () => {
    app = mount({ animate: () => ({ ...fast, duration: 300 }) });
    app.push(at("/post"));
    await settled();

    const hidden: string[] = [];
    const hiddenLayer = (style: string | null | undefined) =>
      !!style?.includes("position: fixed") && style.includes("display: none");
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const now = (record.target as HTMLElement).getAttribute("style");
        if (hiddenLayer(record.oldValue) || hiddenLayer(now))
          hidden.push(record.oldValue ?? "");
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
      attributeOldValue: true,
    });

    await drag(innerWidth * 0.6);
    await wait(150);
    const committed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    touch("touchend", innerWidth * 0.6);
    await committed;
    await frame();
    // The commit landed while the rest of the slide still played, both
    // screens' content still shown though React hid the one left.
    expect(lifted()).toHaveLength(2);
    expect(
      lifted().every(
        (host) => getComputedStyle(contentOf(host)).display !== "none",
      ),
    ).toBe(true);
    expect(
      lifted().some((host) =>
        host.getAnimations().some((a) => a.playState === "running"),
      ),
    ).toBe(true);
    await settled();
    // The record of the last style change, if any, arrives after it.
    await frame();
    observer.disconnect();

    expect(location.pathname).toBe(at("/home"));
    expect(hidden).toEqual([]);
  });

  // A guard on the screen a back lands on sends it to where the back came from
  // (a login page, once logged in): the back ends where it started instead of
  // waiting for a commit of another screen forever, both screens inert.
  test("a swipe back the router redirects to the screen left slides back to rest", async () => {
    // The router redirects before it renders: its listener runs first.
    const guard = () => {
      if (location.pathname === at("/login"))
        history.replaceState(null, "", at("/post"));
    };
    addEventListener("popstate", guard);
    try {
      // A router telling whether it renders the current entry (an adapter).
      app = mount({ view: () => "current" });
      app.push(at("/login"));
      await settled();
      app.push(at("/post"));
      await settled();
      await drag(innerWidth * 0.6);
      await wait(150);
      touch("touchend", innerWidth * 0.6);
      await settled();
    } finally {
      removeEventListener("popstate", guard);
    }
    expect(location.pathname).toBe(at("/post"));
    expect(shown().map(pageOf)).toEqual([at("/post")]);
    expect(lifted()).toHaveLength(0);
  });

  // A router renders the old screen after history moved while its loaders run
  // (React Router): not the back landing there, so the slide waits for it.
  test("a swipe back waits while the router still renders the screen left", async () => {
    // Before the router's own listener: the back's render is the old screen.
    let loading = false;
    const pending = () => {
      if (loading) stale = at("/post");
    };
    addEventListener("popstate", pending);
    app = mount({ view: () => (stale === null ? "current" : "stale") });
    app.push(at("/post"));
    await settled();
    loading = true;
    try {
      await drag(innerWidth * 0.6);
      await wait(150);
      touch("touchend", innerWidth * 0.6);
      await wait(400);
      // History is at /home; the router still renders /post.
      expect(location.pathname).toBe(at("/home"));
      expect(lifted()).toHaveLength(2);
    } finally {
      removeEventListener("popstate", pending);
      stale = null;
    }
    app.render();
    await settled();
    expect(shown().map(pageOf)).toEqual([at("/home")]);
  });

  // The router handles a back in the task of its popstate: in the release's
  // frame, that work held the start of the slide.
  test("a swipe back goes back in history a frame after the release", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    await drag(innerWidth * 0.6);
    await wait(150);
    const back = history.back;
    const calls: string[] = [];
    history.back = () => {
      calls.push("back");
      back.call(history);
    };
    try {
      touch("touchend", innerWidth * 0.6);
      calls.push("released");
      expect(lifted()).toHaveLength(2);
      await frame();
      await frame();
      expect(calls).toEqual(["released", "back"]);
    } finally {
      history.back = back;
    }
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });
});

describe("full-screen swipe", () => {
  let target: Element | null = null;
  const touch = (
    type: string,
    x: number,
    y = 300,
    options: TouchOptions = {},
  ) => {
    if (type === "touchstart") target = options.on ?? page();
    if (!target) throw new Error("no touch started");
    return dispatchTouch(target, type, x, y, options);
  };
  // Past the slop, then to `to`, a frame per move.
  const drag = async (from: number, to: number, on?: Element) => {
    touch("touchstart", from, 300, { on });
    for (let i = 1; i <= 4; i++) {
      touch("touchmove", from + ((to - from) * i) / 4);
      await frame();
    }
  };
  const pushed = async (props: Partial<StackProps> = {}) => {
    app = mount({ swipe: "full", ...props });
    app.push(at("/post"));
    await settled();
  };

  test("off by default", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    await drag(innerWidth * 0.3, innerWidth * 0.9);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.9);
  });

  const onAndroid = async (body: () => Promise<void>) => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (Linux; Android 15; SM-S921N; wv) AppleWebKit/537.36 " +
        "Chrome/141.0 Mobile Safari/537.36",
      configurable: true,
    });
    try {
      await body();
    } finally {
      delete (navigator as { userAgent?: string }).userAgent;
    }
  };

  test("no swipe by default on Android", () =>
    onAndroid(async () => {
      app = mount();
      app.push(at("/post"));
      await settled();
      await drag(5, innerWidth * 0.6);
      expect(lifted()).toHaveLength(0);
      touch("touchend", innerWidth * 0.6);
    }));

  // One prop: a mode set on Android is not left behind the default off.
  test('"full" swipes on Android too', () =>
    onAndroid(async () => {
      await pushed();
      await drag(innerWidth * 0.3, innerWidth * 0.9);
      expect(lifted()).toHaveLength(2);
      touch("touchend", innerWidth * 0.9);
      await settled();
      expect(location.pathname).toBe(at("/home"));
    }));

  test("a drag from mid-screen goes back, the moves cancelled", async () => {
    await pushed();
    touch("touchstart", innerWidth * 0.3);
    const decided = touch("touchmove", innerWidth * 0.3 + 20);
    expect(decided.defaultPrevented).toBe(true);
    for (const x of [0.5, 0.65, 0.8]) {
      expect(touch("touchmove", innerWidth * x, 340).defaultPrevented).toBe(
        true,
      );
      await frame();
    }
    expect(lifted()).toHaveLength(2);
    await wait(150);
    touch("touchend", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  // Past 40% of the width was out of reach from the right of the screen.
  test("a slow drag from the right goes back once it covered 40% of its way", async () => {
    await pushed();
    await drag(innerWidth * 0.7, innerWidth * 0.95);
    await wait(150);
    touch("touchend", innerWidth * 0.95);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("a drag brought back to where it touched stays", async () => {
    await pushed();
    await drag(innerWidth * 0.6, innerWidth * 0.9);
    touch("touchmove", innerWidth * 0.6);
    await wait(150);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a vertical move first is the page's: not cancelled, no swipe after", async () => {
    await pushed();
    touch("touchstart", 100);
    expect(touch("touchmove", 102, 330).defaultPrevented).toBe(false);
    touch("touchmove", 300, 330);
    await frame();
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300, 330);
  });

  test("a move the browser no longer lets cancel (it scrolls) starts nothing", async () => {
    await pushed();
    touch("touchstart", 100);
    touch("touchmove", 130, 300, { cancelable: false });
    touch("touchmove", 300);
    await frame();
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300);
  });

  test("the system taking the touch (touchcancel) mid-drag stays", async () => {
    await pushed();
    await drag(100, innerWidth * 0.8);
    touch("touchcancel", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a second finger cancels the swipe", async () => {
    await pushed();
    await drag(100, innerWidth * 0.5);
    touch("touchstart", 200, 300, { id: 2, fingers: 2 });
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("an element declaring its own horizontal pan keeps it; above the screen it does not count", async () => {
    await pushed();
    page().style.touchAction = "pan-y";
    await drag(100, innerWidth * 0.8);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);
    page().style.touchAction = "";

    // An app root's pan-y, as a fix for double-tap zoom.
    const root = document.querySelector<HTMLElement>("[data-stack-root]");
    for (const element of [document.body, root?.parentElement]) {
      if (!element) continue;
      element.style.touchAction = "pan-y";
    }
    try {
      await drag(100, innerWidth * 0.8);
      expect(lifted()).toHaveLength(2);
      await wait(150);
      touch("touchend", innerWidth * 0.8);
      await settled();
      expect(location.pathname).toBe(at("/home"));
    } finally {
      document.body.style.touchAction = "";
      if (root?.parentElement) root.parentElement.style.touchAction = "";
    }
  });

  test("a scroller that can scroll back left keeps the drag; at its start the swipe goes back", async () => {
    await pushed();
    const scroller = document.createElement("div");
    Object.assign(scroller.style, { overflowX: "auto", width: "200px" });
    const wide = document.createElement("div");
    wide.style.width = "1000px";
    wide.textContent = "wide";
    scroller.append(wide);
    page().append(scroller);

    scroller.scrollLeft = 300;
    await drag(100, innerWidth * 0.8, wide);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);

    scroller.scrollLeft = 0;
    await drag(100, innerWidth * 0.8, wide);
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.8);
    await settled();
  });

  test("a control that drags sideways or data-stack-no-swipe keeps the drag", async () => {
    await pushed();
    for (const html of [
      '<input type="range">',
      "<textarea></textarea>",
      "<video controls></video>",
      "<div contenteditable><span>text</span></div>",
      '<span role="slider"><span>thumb</span></span>',
      "<div data-stack-no-swipe><span>carousel</span></div>",
    ]) {
      const host = document.createElement("div");
      host.innerHTML = html;
      page().append(host);
      const on = host.querySelector("span") ?? host.firstElementChild!;
      await drag(100, innerWidth * 0.8, on);
      expect(lifted()).toHaveLength(0);
      touch("touchend", innerWidth * 0.8);
      host.remove();
    }
  });

  test("a control only tapped (a checkbox) does not keep the drag", async () => {
    await pushed();
    for (const html of [
      '<input type="checkbox">',
      '<div contenteditable="false"><span>text</span></div>',
    ]) {
      const host = document.createElement("div");
      host.innerHTML = html;
      page().append(host);
      const on = host.querySelector("span") ?? host.firstElementChild!;
      await drag(100, innerWidth * 0.8, on);
      expect(lifted()).toHaveLength(2);
      touch("touchend", innerWidth * 0.8);
      await settled();
      expect(location.pathname).toBe(at("/home"));
      app?.push(at("/post"));
      await settled();
    }
  });

  // A native edge gesture wins over a text field; a slider keeps its drag.
  test("at the edge, text still swipes; a slider or data-stack-no-swipe keeps the drag", async () => {
    await pushed();
    const field = document.createElement("input");
    page().append(field);
    await drag(5, innerWidth * 0.8, field);
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/home"));

    app?.push(at("/post"));
    await settled();
    for (const html of [
      '<input type="range">',
      "<div data-stack-no-swipe>x</div>",
    ]) {
      const host = document.createElement("div");
      host.innerHTML = html;
      page().append(host);
      await drag(5, innerWidth * 0.8, host.firstElementChild!);
      expect(lifted()).toHaveLength(0);
      touch("touchend", innerWidth * 0.8);
      host.remove();
    }
  });

  test("a slider inside a shadow root keeps the drag", async () => {
    await pushed();
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" }).innerHTML =
      '<div role="slider"><span>thumb</span></div>';
    page().append(host);
    await drag(100, innerWidth * 0.8, host.shadowRoot!.querySelector("span")!);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);
  });

  // A sheet portaled out of the screen keeps its drags.
  test("a touch outside the shown screen starts nothing", async () => {
    await pushed();
    const sheet = document.createElement("div");
    document.body.append(sheet);
    try {
      await drag(100, innerWidth * 0.8, sheet);
      expect(lifted()).toHaveLength(0);
      touch("touchend", innerWidth * 0.8);
    } finally {
      sheet.remove();
    }
  });

  test('swipe as a function keeps only the edge for the backs it gives "edge"', async () => {
    await pushed({
      swipe: (from) => (from.endsWith("/post") ? "edge" : "full"),
    });
    await drag(100, innerWidth * 0.8);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);

    await drag(5, innerWidth * 0.8);
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  // The page under the finger replaced (a loading skeleton): its events go to
  // the removed element only, and the drag froze until the next touch.
  test("a touched element removed mid-drag still drives the swipe", async () => {
    await pushed();
    const child = document.createElement("div");
    child.textContent = "skeleton";
    page().append(child);
    await drag(100, innerWidth * 0.5, child);
    child.remove();
    touch("touchmove", innerWidth * 0.8);
    await frame();
    await wait(150);
    touch("touchend", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });
});
