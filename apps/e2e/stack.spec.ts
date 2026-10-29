import {
  test as base,
  expect,
  type CDPSession,
  type Page,
} from "@playwright/test";

type LogEntry = { event: string; data?: Record<string, unknown>; time: number };
type Frame = {
  scrollY: number;
  lifted: number;
  url: string;
  rects: { top: number; bottom: number }[];
};

declare global {
  interface Window {
    __rsLog: LogEntry[];
    __rsFrames: Frame[];
    __rsProps: string[];
    __rsNegative: number[];
    __rsWatch: string | null;
  }
}

// Runs before any app script: the library's log sink, a per-frame recorder
// and a playbackRate guard.
function instrument() {
  const log: LogEntry[] = (window.__rsLog = []);
  (globalThis as Record<symbol, unknown>)[Symbol.for("route-stack.log")] = (
    event: string,
    data?: Record<string, unknown>,
  ) => log.push({ event, data, time: performance.now() });

  const negative: number[] = (window.__rsNegative = []);
  const rate = Object.getOwnPropertyDescriptor(
    Animation.prototype,
    "playbackRate",
  )!;
  Object.defineProperty(Animation.prototype, "playbackRate", {
    ...rate,
    set(value: number) {
      if (value < 0) negative.push(value);
      rate.set!.call(this, value);
    },
  });

  const update = Animation.prototype.updatePlaybackRate;
  Animation.prototype.updatePlaybackRate = function (value: number) {
    if (value < 0) negative.push(value);
    return update.call(this, value);
  };

  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    const playbackRate =
      typeof options === "object" ? options.playbackRate : undefined;
    if (playbackRate !== undefined && playbackRate < 0)
      negative.push(playbackRate);
    return animate.call(this, keyframes, options);
  };

  const props = new Set<string>();
  window.__rsProps = [];
  window.__rsWatch = null;
  const frames: Frame[] = (window.__rsFrames = []);
  const META = new Set(["offset", "computedOffset", "easing", "composite"]);

  const tick = () => {
    const hosts = document.querySelectorAll<HTMLElement>(
      "[data-stack-root] > [data-stack-screen]",
    );
    const lifted = [...hosts].filter(
      (host) => host.style.position === "fixed",
    ).length;
    const rects = window.__rsWatch
      ? [...document.querySelectorAll(window.__rsWatch)]
          .map((el) => el.getBoundingClientRect())
          .filter((rect) => rect.height > 0)
          .map(({ top, bottom }) => ({ top, bottom }))
      : [];

    if (lifted) {
      // The slide's own animations: the hosts, and the shade appended directly
      // under one.
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (
          !target?.matches(
            "[data-stack-screen], [data-stack-screen] > :not([data-stack-content])",
          )
        )
          continue;
        for (const keyframe of (
          animation.effect as KeyframeEffect
        ).getKeyframes())
          for (const property of Object.keys(keyframe))
            if (!META.has(property)) props.add(property);
      }
      window.__rsProps = [...props];
    }

    frames.push({
      scrollY,
      lifted,
      url: location.pathname + location.search,
      rects,
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const test = base.extend<{ app: string; errors: string[] }>({
  // Playwright reads fixture dependencies from this destructuring: it must be
  // an object pattern.
  // oxlint-disable-next-line no-empty-pattern
  app: async ({}, use, info) => use(info.project.metadata.app as string),
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on(
        "console",
        (message) => message.type() === "error" && errors.push(message.text()),
      );
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(instrument);

      await use(errors);

      // Scenarios 11 and 12, after every test.
      expect(errors, "console errors").toEqual([]);
      if (page.isClosed()) return;

      const { negative = [], props = [] } = await page.evaluate(() => ({
        negative: window.__rsNegative,
        props: window.__rsProps,
      }));
      expect(negative, "negative playbackRate").toEqual([]);
      expect(
        props.filter((prop) => prop !== "transform" && prop !== "opacity"),
        "animated props",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

// ---------- helpers

const path = (page: Page) => {
  const url = new URL(page.url());
  return decodeURIComponent(url.pathname + url.search);
};
const waitPath = (page: Page, want: string) =>
  page.waitForURL(
    (url) => decodeURIComponent(url.pathname + url.search) === want,
  );

const nextFrames = (page: Page, count = 2) =>
  page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        const step = (left: number) =>
          left ? requestAnimationFrame(() => step(left - 1)) : resolve();
        step(frameCount);
      }),
    count,
  );

/** Marks where a step starts in the log and the frame record. */
const mark = (page: Page) =>
  page.evaluate(() => ({
    log: window.__rsLog.length,
    frames: window.__rsFrames.length,
  }));
type Mark = Awaited<ReturnType<typeof mark>>;

const logSince = (page: Page, since: Mark) =>
  page.evaluate((start) => window.__rsLog.slice(start), since.log);
const framesSince = (page: Page, since: Mark) =>
  page.evaluate((start) => window.__rsFrames.slice(start), since.frames);
const events = (log: LogEntry[], event: string) =>
  log.filter((entry) => entry.event === event);

const liftedNow = (page: Page) =>
  page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "[data-stack-root] > [data-stack-screen]",
        ),
      ].filter((host) => host.style.position === "fixed").length,
  );

/** Settled: a `settle` logged since the mark and no layer lifted. */
async function settled(page: Page, since: Mark) {
  await page.waitForFunction(
    (start) =>
      window.__rsLog.slice(start).some((entry) => entry.event === "settle") &&
      ![
        ...document.querySelectorAll<HTMLElement>(
          "[data-stack-root] > [data-stack-screen]",
        ),
      ].some((host) => host.style.position === "fixed"),
    since.log,
  );
  await nextFrames(page);
}

const hosts = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "[data-stack-root] > [data-stack-screen]",
      ),
    ].map((host) => ({
      id: host.dataset.stackScreen!,
      // React hides the content; the screen element is the slide's layer.
      shown:
        getComputedStyle(host.firstElementChild as HTMLElement).display !==
        "none",
    })),
  );
const shownId = async (page: Page) => {
  const shown = (await hosts(page)).filter((host) => host.shown);
  expect(shown, "exactly one shown screen").toHaveLength(1);
  return shown[0]!.id;
};

async function scrollToY(page: Page, targetY: number) {
  await page.evaluate((top) => scrollTo(0, top), targetY);
  // The library records the scroll from its scroll listener.
  await nextFrames(page, 3);
  return page.evaluate(() => scrollY);
}

async function openHome(page: Page) {
  await page.goto("/");
  await page.locator(".card").nth(100).waitFor({ state: "attached" });
  await page.locator("[data-stack-root]").waitFor({ state: "attached" });
  await page.waitForLoadState("networkidle");
}

/** Clicks a link without scrolling the window to it. */
const clickLink = (page: Page, selector: string, index = 0) =>
  page.evaluate(
    ({ linkSelector, linkIndex }) => {
      const shown = [
        ...document.querySelectorAll("[data-stack-root] > [data-stack-screen]"),
      ].find(
        (host) =>
          getComputedStyle(host.firstElementChild as HTMLElement).display !==
          "none",
      )!;
      (shown.querySelectorAll(linkSelector)[linkIndex] as HTMLElement).click();
    },
    { linkSelector: selector, linkIndex: index },
  );

/** Home scrolled into the feed, then a push to an item from a card in view. */
async function pushFromScrolledHome(page: Page) {
  await openHome(page);
  const homeScrollY = await scrollToY(page, 3000);
  expect(homeScrollY).toBeGreaterThan(1000);
  const homeId = await shownId(page);

  const index = await page.evaluate(() =>
    [...document.querySelectorAll(".card h2 a")].findIndex(
      (link) => link.getBoundingClientRect().top > 120,
    ),
  );
  const href = await page.locator(".card h2 a").nth(index).getAttribute("href");

  const pushMark = await mark(page);
  await page.locator(".card h2 a").nth(index).click();
  await waitPath(page, href!);
  await settled(page, pushMark);

  return { homeScrollY, homeId, itemPath: href!, pushMark };
}

// ---------- touches

interface Finger {
  start(x: number): Promise<void>;
  move(x: number): Promise<void>;
  end(): Promise<void>;
  cancel(): Promise<void>;
}

const TOUCH_Y = 400;

/**
 * Real touches through CDP on Chromium; elsewhere synthetic touch events on
 * the element under the point, which gets all of the touch's events, as a
 * browser sends them.
 */
async function finger(page: Page, browser: string): Promise<Finger> {
  if (browser === "chromium") {
    const cdp: CDPSession = await page.context().newCDPSession(page);
    // The element and identifier of the real touch, for moves sent from the
    // page (flickInPage): a touch's events all go to its first target.
    await page.evaluate(() =>
      addEventListener(
        "touchstart",
        (event) => {
          const held = globalThis as {
            touched?: EventTarget | null;
            touchId?: number;
          };
          held.touched = event.target;
          held.touchId = event.changedTouches[0]?.identifier;
        },
        { capture: true, passive: true },
      ),
    );
    const send = (type: string, x?: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: x === undefined ? [] : [{ x, y: TOUCH_Y, id: 1 }],
      } as never);

    return {
      start: (x) => send("touchStart", x),
      move: (x) => send("touchMove", x),
      end: () => send("touchEnd"),
      cancel: () => send("touchCancel"),
    };
  }

  let lastX = 0;
  const send = (type: string, x: number) =>
    page.evaluate(
      ({ eventType, clientX, clientY }) => {
        // A plain event with the touch points the swipe reads: WebKit on
        // macOS constructs neither Touch nor TouchEvent.
        const held = globalThis as { touched?: EventTarget | null };
        if (eventType === "touchstart")
          held.touched = document.elementFromPoint(clientX, clientY);
        const target = held.touched!;
        const touch = { identifier: 1, target, clientX, clientY };
        const ended = eventType === "touchend" || eventType === "touchcancel";
        target.dispatchEvent(
          Object.assign(
            new Event(eventType, { bubbles: true, cancelable: true }),
            { changedTouches: [touch], touches: ended ? [] : [touch] },
          ),
        );
      },
      { eventType: type, clientX: x, clientY: TOUCH_Y },
    );

  return {
    start: (x) => send("touchstart", (lastX = x)),
    move: (x) => send("touchmove", (lastX = x)),
    end: () => send("touchend", lastX),
    cancel: () => send("touchcancel", lastX),
  };
}

/**
 * Moves the finger through `points`, `every` ms apart, then lifts it: touch
 * events dispatched on the element touched from the page, so their timing is
 * the page's.
 */
const flickInPage = (page: Page, points: number[], every: number) =>
  page.evaluate(
    async ({ flickPoints, interval, clientY }) => {
      // The element the touch started on (`finger` remembers it), else the one
      // under the first point.
      const held = globalThis as {
        touched?: EventTarget | null;
        touchId?: number;
      };
      const target =
        held.touched ?? document.elementFromPoint(flickPoints[0]!, clientY)!;
      const send = (eventType: string, clientX: number) => {
        const point = {
          identifier: held.touchId ?? 1,
          target,
          clientX,
          clientY,
        };
        const ended = eventType === "touchend";

        target.dispatchEvent(
          Object.assign(
            new Event(eventType, { bubbles: true, cancelable: true }),
            { changedTouches: [point], touches: ended ? [] : [point] },
          ),
        );
      };

      for (const clientX of flickPoints) {
        send("touchmove", clientX);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      send("touchend", flickPoints.at(-1)!);
    },
    { flickPoints: points, interval: every, clientY: TOUCH_Y },
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const VIEWPORT_WIDTH = 390;
const PAST = Math.round(VIEWPORT_WIDTH * 0.6); // released well past 40%
const SHORT = Math.round(VIEWPORT_WIDTH * 0.25); // released well short of it

/**
 * Moves from `from` to `to` in steps of `step` px, `every` ms apart (slow:
 * about 0.2 px/ms).
 */
async function drag(
  touch: Finger,
  from: number,
  to: number,
  step = 8,
  every = 40,
) {
  for (let x = from + step; x < to; x += step) {
    await touch.move(x);
    await sleep(every);
  }
  await touch.move(to);
}

/**
 * The swipe released short of the threshold slid back to rest on the same
 * screen.
 */
async function expectCancelled(
  page: Page,
  since: Mark,
  at: string,
  id: string,
) {
  await settled(page, since);
  expect(path(page)).toBe(at);
  expect(await shownId(page)).toBe(id);

  const log = await logSince(page, since);
  expect(events(log, "release").map((entry) => entry.data?.back)).toEqual([
    false,
  ]);
  expect(events(log, "commit")).toEqual([]);
}

async function expectSwipedBack(
  page: Page,
  since: Mark,
  pushed: { homeScrollY: number; homeId: string },
) {
  await waitPath(page, "/");
  await settled(page, since);
  expect(await shownId(page)).toBe(pushed.homeId);
  expect(Math.round(await page.evaluate(() => scrollY))).toBe(
    Math.round(pushed.homeScrollY),
  );
  await expect.poll(async () => (await hosts(page)).length).toBe(1);

  const log = await logSince(page, since);
  expect(events(log, "release").map((entry) => entry.data?.back)).toEqual([
    true,
  ]);
  expect(events(log, "late-scroll")).toEqual([]);
}

// ---------- scenarios

test("1. push from a scrolled list lifts two layers, then shows one screen and keeps the previous hidden", async ({
  page,
}) => {
  const { homeId, pushMark } = await pushFromScrolledHome(page);

  const frames = await framesSince(page, pushMark);
  expect(Math.max(...frames.map((frame) => frame.lifted))).toBe(2);
  const commits = events(await logSince(page, pushMark), "commit");
  expect(commits.map((entry) => entry.data?.direction)).toEqual(["push"]);

  const all = await hosts(page);
  expect(all).toHaveLength(2);
  expect(all.find((host) => host.id === homeId)?.shown).toBe(false);
  await shownId(page);

  // The hidden screen still holds its own page, not a copy of the pushed one.
  const kept = page.locator(`[data-stack-screen="${homeId}"]`);
  await expect(kept.locator(".header h1")).toHaveText("홈");
  expect(await kept.locator(".card").count()).toBeGreaterThan(100);
});

test("2. browser back restores the previous screen's scroll exactly and prunes the pushed one", async ({
  page,
}) => {
  const pushed = await pushFromScrolledHome(page);

  const backMark = await mark(page);
  await page.goBack({ waitUntil: "commit" });
  await waitPath(page, "/");
  await settled(page, backMark);

  expect(await shownId(page)).toBe(pushed.homeId);
  expect(Math.round(await page.evaluate(() => scrollY))).toBe(
    Math.round(pushed.homeScrollY),
  );
  await expect.poll(async () => (await hosts(page)).length).toBe(1);
  const log = await logSince(page, backMark);
  expect(events(log, "commit").map((entry) => entry.data?.direction)).toEqual([
    "back",
  ]);
  expect(events(log, "late-scroll")).toEqual([]);
});

test("3. the window is aimed before the layers drop (no scroll in the drop frame)", async ({
  page,
  browserName,
}) => {
  const pushed = await pushFromScrolledHome(page);

  const backMark = await mark(page);
  await page.goBack({ waitUntil: "commit" });
  await waitPath(page, "/");
  await settled(page, backMark);

  // And a swipe back, whose drop is decided by a finger.
  if (browserName === "chromium") {
    const swipeMark = await mark(page);
    await page.locator(".card h2 a").filter({ visible: true }).nth(1).click();
    await settled(page, swipeMark);

    const touch = await finger(page, browserName);
    await touch.start(5);
    await drag(touch, 5, PAST, 30, 20);
    await touch.end();
    await waitPath(page, "/");
    await settled(page, swipeMark);
  }

  const frames = await framesSince(page, pushed.pushMark);
  const bad = frames.flatMap((frame, i) => {
    const prev = frames[i - 1];
    return prev &&
      prev.lifted > 0 &&
      frame.lifted === 0 &&
      frame.scrollY !== prev.scrollY
      ? [{ frame: i, from: prev.scrollY, to: frame.scrollY }]
      : [];
  });
  expect(frames.some((frame) => frame.lifted > 0)).toBe(true);
  expect(bad).toEqual([]);
});

test("4. an in-screen fixed element stays within the viewport during the slide", async ({
  page,
}) => {
  await openHome(page);
  await scrollToY(page, 1500);
  await page.evaluate(() => (window.__rsWatch = ".fixed-bar"));

  const pushMark = await mark(page);
  await clickLink(page, 'a[href="/lab"]');
  await waitPath(page, "/lab");
  await settled(page, pushMark);

  const backMark = await mark(page);
  await page.goBack({ waitUntil: "commit" });
  await waitPath(page, "/");
  await settled(page, backMark);

  const frames = (await framesSince(page, pushMark)).filter(
    (frame) => frame.lifted > 0 && frame.rects.length,
  );
  expect(frames.length).toBeGreaterThan(3);
  const height = await page.evaluate(() => innerHeight);
  const outside = frames.flatMap((frame) =>
    frame.rects
      .filter((rect) => rect.top < -1 || rect.bottom > height + 1)
      .map((rect) => ({ ...rect, scrollY: frame.scrollY })),
  );
  expect(outside).toEqual([]);
});

test.describe("5. edge swipe", () => {
  test("slow short drag cancels; after ten, a swipe still goes back", async ({
    page,
    browserName,
  }) => {
    const pushed = await pushFromScrolledHome(page);
    const id = await shownId(page);
    const touch = await finger(page, browserName);

    for (let i = 0; i < 10; i++) {
      const swipeMark = await mark(page);
      await touch.start(5);
      await drag(touch, 5, SHORT);
      await touch.end();
      await expectCancelled(page, swipeMark, pushed.itemPath, id);
    }

    const swipeMark = await mark(page);
    await touch.start(5);
    await drag(touch, 5, PAST, 30, 20);
    await touch.end();
    await expectSwipedBack(page, swipeMark, pushed);
  });

  test("drag past 40% goes back with the scroll restored", async ({
    page,
    browserName,
  }) => {
    const pushed = await pushFromScrolledHome(page);
    const touch = await finger(page, browserName);

    const swipeMark = await mark(page);
    await touch.start(5);
    await drag(touch, 5, PAST);
    await touch.end();

    await expectSwipedBack(page, swipeMark, pushed);
  });

  test("rest then flick goes back", async ({ page, browserName }) => {
    const pushed = await pushFromScrolledHome(page);
    const touch = await finger(page, browserName);

    const swipeMark = await mark(page);
    await touch.start(5);
    await drag(touch, 5, 40);
    await sleep(200);
    // 100px in four moves 8ms apart, released short of 40%. Timed in the page:
    // a round trip per move on a loaded machine slows the flick below the back
    // speed, and moves sent at once are coalesced into one.
    expect(140 / VIEWPORT_WIDTH).toBeLessThan(0.4);
    await flickInPage(page, [65, 90, 115, 140], 8);

    await expectSwipedBack(page, swipeMark, pushed);
  });

  test("drag, stop for 200ms and release short of 40% cancels", async ({
    page,
    browserName,
  }) => {
    const pushed = await pushFromScrolledHome(page);
    const id = await shownId(page);
    const touch = await finger(page, browserName);

    const swipeMark = await mark(page);
    await touch.start(5);
    for (const x of [40, 80, 120, 140]) await touch.move(x);
    await sleep(200);
    await touch.end();

    await expectCancelled(page, swipeMark, pushed.itemPath, id);
  });

  test("touchcancel mid-drag stays", async ({ page, browserName }) => {
    const pushed = await pushFromScrolledHome(page);
    const id = await shownId(page);
    const touch = await finger(page, browserName);

    const swipeMark = await mark(page);
    await touch.start(5);
    await drag(touch, 5, PAST);
    await touch.cancel();

    await expectCancelled(page, swipeMark, pushed.itemPath, id);
  });
});

test("6. a swipe right after a push settles works", async ({
  page,
  browserName,
}) => {
  const pushed = await pushFromScrolledHome(page);
  const touch = await finger(page, browserName);

  const swipeMark = await mark(page);
  await touch.start(5);
  await drag(touch, 5, PAST, 30, 20);
  await touch.end();

  await expectSwipedBack(page, swipeMark, pushed);
});

test.describe("7. query", () => {
  test("?category= push is a new screen; back returns to the previous one with its scroll", async ({
    page,
  }) => {
    await openHome(page);
    const homeScrollY = await scrollToY(page, 2000);
    const homeId = await shownId(page);

    const pushMark = await mark(page);
    await clickLink(page, '.chips a[href="/?category=dev"]');
    await waitPath(page, "/?category=dev");
    await settled(page, pushMark);
    expect(await shownId(page)).not.toBe(homeId);
    expect(await hosts(page)).toHaveLength(2);
    expect(
      Math.max(
        ...(await framesSince(page, pushMark)).map((frame) => frame.lifted),
      ),
    ).toBe(2);

    const backMark = await mark(page);
    await page.goBack({ waitUntil: "commit" });
    await waitPath(page, "/");
    await settled(page, backMark);
    expect(await shownId(page)).toBe(homeId);
    expect(Math.round(await page.evaluate(() => scrollY))).toBe(
      Math.round(homeScrollY),
    );
  });

  // Next tells push from replace before it renders (the hint): a query push
  // cutting a back's slide is still a new screen.
  test("a query push during a back's slide is a new screen", async ({
    page,
    app,
  }) => {
    test.skip(app !== "next", "the hint is Next's");
    await openHome(page);
    await clickLink(page, ".card h2 a");
    await page.waitForURL(/\/items\//);
    await nextFrames(page, 30);

    const backMark = await mark(page);
    await page.goBack({ waitUntil: "commit" });
    await waitPath(page, "/");
    // Mid-slide (layers inert: a script click, as Next's Link handles it).
    await page.evaluate(() =>
      (
        document.querySelector('.chips a[href="/?category=dev"]') as HTMLElement
      ).click(),
    );
    await waitPath(page, "/?category=dev");
    await settled(page, backMark);

    expect(
      events(await logSince(page, backMark), "commit").map(
        (entry) => entry.data?.direction,
      ),
    ).toEqual(["back", "push"]);
  });

  // React Router's <Link replace>, TanStack's, Next's router.replace (hinted).
  test("a sort replace on the results keeps the screen, without a slide", async ({
    page,
  }) => {
    await page.goto("/search/results?q=스택&sort=new");
    await page.waitForLoadState("networkidle");
    const id = await shownId(page);

    const sortMark = await mark(page);
    await clickLink(page, ".tabs a", 1);
    await waitPath(page, "/search/results?q=스택&sort=popular");
    await nextFrames(page, 5);

    expect(await shownId(page)).toBe(id);
    expect(await hosts(page)).toHaveLength(1);
    expect(events(await logSince(page, sortMark), "commit")).toEqual([]);
    expect(
      (await framesSince(page, sortMark)).some((frame) => frame.lifted > 0),
    ).toBe(false);
  });

  // The effect that adds `sort` (router.replace, setSearchParams, navigate)
  // stays on the screen pushed.
  test("a results page normalizing its query is a single push", async ({
    page,
  }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const searchId = await shownId(page);

    const pushMark = await mark(page);
    await clickLink(page, ".chip");
    await page.waitForURL(
      (url) =>
        url.pathname === "/search/results" &&
        url.searchParams.get("sort") === "new",
    );
    await settled(page, pushMark);

    expect(
      events(await logSince(page, pushMark), "commit").map(
        (entry) => entry.data?.direction,
      ),
    ).toEqual(["push"]);
    const ids = (await hosts(page)).map((host) => host.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(searchId);
    expect(await shownId(page)).not.toBe(searchId);
  });

  test("/search typing replaces ?q= on the same mounted screen, keeping focus", async ({
    page,
  }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[name="q"]').filter({ visible: true });
    await input.focus();
    const id = await shownId(page);

    const typingMark = await mark(page);
    await input.pressSequentially("스택", { delay: 50 });
    await waitPath(page, "/search?q=스택");
    await nextFrames(page, 5);

    expect(await shownId(page)).toBe(id);
    expect(await hosts(page)).toHaveLength(1);
    expect(events(await logSince(page, typingMark), "commit")).toEqual([]);
    expect(
      (await framesSince(page, typingMark)).some((frame) => frame.lifted > 0),
    ).toBe(false);
    expect(await input.evaluate((el) => el === document.activeElement)).toBe(
      true,
    );
    expect(await input.inputValue()).toBe("스택");
  });
});

test("8. #comments on the same URL is the same screen (no slide)", async ({
  page,
}) => {
  await page.goto("/items/1");
  await page.locator("#comments").waitFor();
  await page.waitForLoadState("networkidle");
  const id = await shownId(page);

  const hashMark = await mark(page);
  await page.getByRole("link", { name: "댓글 보기 ↓" }).click();
  await page.waitForURL((url) => url.hash === "#comments");
  await nextFrames(page, 5);

  expect(await shownId(page)).toBe(id);
  expect(events(await logSince(page, hashMark), "commit")).toEqual([]);
  expect(
    (await framesSince(page, hashMark)).some((frame) => frame.lifted > 0),
  ).toBe(false);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test.describe("9. redirect during a slide is one slide", () => {
  const risingEdges = (frames: Frame[]) =>
    frames.filter(
      (frame, i) => frame.lifted > 0 && (frames[i - 1]?.lifted ?? 0) === 0,
    ).length;

  test("logged out /settings (client guard replace) retargets the running slide to login", async ({
    page,
  }) => {
    await openHome(page);

    const pushMark = await mark(page);
    await clickLink(page, 'a[href="/settings"]');
    await waitPath(page, "/login?next=/settings");
    await settled(page, pushMark);
    await nextFrames(page, 10);

    const log = await logSince(page, pushMark);
    const commits = events(log, "commit").map((entry) => entry.data?.direction);
    expect(commits[0]).toBe("push");
    expect(commits.filter((direction) => direction === "push")).toHaveLength(1);
    expect(
      commits.filter((direction) => direction === "replace").length,
    ).toBeLessThanOrEqual(1);
    expect(events(log, "begin")).toEqual([]);
    expect(risingEdges(await framesSince(page, pushMark))).toBe(1);
    await expect(
      page.locator(".header h1").filter({ visible: true }),
    ).toHaveText("로그인");
    await shownId(page);
  });

  test("logged out /me from the tab bar (redirect before render) is one slide to login", async ({
    page,
  }) => {
    await openHome(page);

    const pushMark = await mark(page);
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('.tabbar a[href="/me"]')!.click(),
    );
    await waitPath(page, "/login?next=/me");
    await page.waitForLoadState("networkidle");
    await nextFrames(page, 30);

    expect(await liftedNow(page)).toBe(0);
    expect(risingEdges(await framesSince(page, pushMark))).toBeLessThanOrEqual(
      1,
    );
    await expect(
      page.locator(".header h1").filter({ visible: true }),
    ).toHaveText("로그인");
    await shownId(page);
  });
});

test("10. a blocker stops a swipe back and slides back to rest; confirming leaves", async ({
  page,
  app,
  browserName,
}) => {
  test.skip(app === "next", "the Next app has no blocker on its edit page");
  await page.goto("/items/3");
  await page.waitForLoadState("networkidle");

  let stepMark = await mark(page);
  await page.getByRole("link", { name: "수정" }).click();
  await waitPath(page, "/items/3/edit");
  await settled(page, stepMark);
  const title = page.locator('input[name="title"]').filter({ visible: true });
  await title.fill("저장 안 할 제목");

  const touch = await finger(page, browserName);
  stepMark = await mark(page);
  await touch.start(5);
  await drag(touch, 5, PAST, 30, 20);
  await touch.end();

  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  await expect
    .poll(
      async () => events(await logSince(page, stepMark), "blocked").length,
      {
        message:
          "the blocker sent history back to the edit entry and the slide returned to rest",
        timeout: 5000,
      },
    )
    .toBe(1);
  await settled(page, stepMark);
  // The edit screen is back in place under the dialog. The URL meanwhile is the
  // router's: React Router restores it at once, TanStack keeps the entry
  // history went to until the user answers.
  await expect(title).toBeVisible();
  expect(await title.inputValue()).toBe("저장 안 할 제목");

  stepMark = await mark(page);
  await dialog.getByRole("button", { name: "나가기" }).click();
  await waitPath(page, "/items/3");
  await settled(page, stepMark);
  await expect(
    page.locator(".header h1").filter({ visible: true }),
  ).not.toHaveText(/수정/);
  await shownId(page);
});

test("10b. a blocker that lets the swipe back go slides once", async ({
  page,
  app,
  browserName,
}) => {
  test.skip(app === "next", "the Next app has no blocker on its edit page");
  await page.goto("/items/3");
  await page.waitForLoadState("networkidle");

  let stepMark = await mark(page);
  await page.getByRole("link", { name: "수정" }).click();
  await waitPath(page, "/items/3/edit");
  await settled(page, stepMark);

  // Nothing typed: the blocker is there but lets the navigation go.
  const touch = await finger(page, browserName);
  stepMark = await mark(page);
  await touch.start(5);
  await drag(touch, 5, PAST, 30, 20);
  await touch.end();
  await waitPath(page, "/items/3");
  await settled(page, stepMark);

  const log = await logSince(page, stepMark);
  expect(events(log, "blocked"), "not taken for a refusal").toHaveLength(0);
  expect(
    events(log, "commit").map((entry) => entry.data?.phase),
    "the back commits into the swipe's own slide, not a new one",
  ).toEqual(["play"]);
});

// Each app's session cookie (its `isLoggedIn`).
const SESSION_COOKIES: Record<string, string> = {
  "react-router-spa": "rrspa_session",
  "react-router-ssr": "rrssr_session",
  "tanstack-router": "tsr_session",
  "tanstack-start": "tss_session",
};

test("10c. a swipe back the login guard redirects to the screen left slides back to rest", async ({
  page,
  app,
  browserName,
}) => {
  test.skip(
    app === "next",
    "the Next app guards login in its proxy: a back renders the cached page",
  );
  await page.goto("/login?next=/about");
  await page.locator("[data-stack-root]").waitFor({ state: "attached" });
  await page.waitForLoadState("networkidle");

  let stepMark = await mark(page);
  await clickLink(page, 'a[href="/about"]');
  await waitPath(page, "/about");
  await settled(page, stepMark);
  const aboutId = await shownId(page);

  // Logged in elsewhere: the login page now sends a visitor on to /about.
  await page
    .context()
    .addCookies([{ name: SESSION_COOKIES[app]!, value: "1", url: page.url() }]);

  const touch = await finger(page, browserName);
  stepMark = await mark(page);
  await touch.start(5);
  await drag(touch, 5, PAST, 30, 20);
  await touch.end();
  await settled(page, stepMark);

  expect(path(page)).toBe("/about");
  expect(await shownId(page)).toBe(aboutId);
  const log = await logSince(page, stepMark);
  expect(events(log, "release").map((entry) => entry.data?.back)).toEqual([
    true,
  ]);
  expect(events(log, "returned")).toHaveLength(1);
});

test("11. pages load without console or hydration errors", async ({ page }) => {
  // The fixture fails the test on any console error or page error.
  for (const route of ["/", "/items/1", "/search", "/lab", "/products?id=1"]) {
    await page.goto(route);
    await page.locator(".header h1").first().waitFor();
    await page.waitForLoadState("networkidle");
  }
});

test("12. slides animate only transform/opacity and never a negative playbackRate", async ({
  page,
  browserName,
}) => {
  await pushFromScrolledHome(page);

  const backMark = await mark(page);
  await page.goBack({ waitUntil: "commit" });
  await waitPath(page, "/");
  await settled(page, backMark);

  if (browserName === "chromium") {
    // A finger released mid-way plays the rest back to rest: the case a
    // reversed play would hit.
    const pushMark = await mark(page);
    await page.locator(".card h2 a").filter({ visible: true }).nth(1).click();
    await settled(page, pushMark);

    const touch = await finger(page, browserName);
    const swipeMark = await mark(page);
    await touch.start(5);
    await drag(touch, 5, SHORT);
    await touch.end();
    await settled(page, swipeMark);
  }

  const { negative, props } = await page.evaluate(() => ({
    negative: window.__rsNegative,
    props: window.__rsProps,
  }));
  expect(props.length).toBeGreaterThan(0);
  expect(
    props.every((prop) => prop === "transform" || prop === "opacity"),
  ).toBe(true);
  expect(negative).toEqual([]);
});
