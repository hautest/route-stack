import { describe, expect, test } from "vitest";
import {
  dispatchTouch,
  finishSlide,
  frame,
  lifted,
  recordFrames,
  rested,
  scrolled,
  scrollsWhenDropping,
  settled,
  slideAt,
  until,
} from "../test/browser";
import {
  at,
  mount,
  offsetX,
  pageOf,
  progress,
  progressUntilSettled,
  router,
  setupStack,
  shown,
} from "../test/stack";
import { contentOf } from "../transition/layers";

setupStack();

let app: ReturnType<typeof mount> | null = null;

const page = () =>
  document.querySelector<HTMLElement>(`[data-page="${location.pathname}"]`)!;

describe("edge swipe", () => {
  // On the shown page, the target of all the touch's events, as a browser.
  let target: Element | null = null;
  // The touches' clock: each event `dt` ms after the last (a frame by
  // default), a rest given as a longer one.
  let now = 0;
  const touch = (type: string, x: number, dt = 16) => {
    if (type === "touchstart") target = page();
    if (!target) throw new Error("no touch started");
    dispatchTouch(target, type, x, 300, { at: (now += dt) });
  };
  const drag = (to: number, steps = 6) => {
    touch("touchstart", 5);
    for (let i = 1; i <= steps; i++)
      touch("touchmove", 5 + ((to - 5) * i) / steps);
  };

  test("a swipe starts only with a screen to go back to", async () => {
    app = mount();
    drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.6);

    app.push(at("/post"));
    await settled();
    drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.6);
    await settled();
  });

  // Not committed yet, the screen behind is still hidden for React.
  test("a swipe keeps the screen behind inert until its back commits", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    drag(innerWidth * 0.3);
    const behind = lifted().find((host) => pageOf(host) === at("/home"))!;
    expect(behind.inert).toBe(true);
    touch("touchend", innerWidth * 0.3);
    await settled();
  });

  test("past the edge, a touch is the page's with swipe 'edge'", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    touch("touchstart", 100);
    for (const x of [130, 200, 300]) touch("touchmove", x);
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300);
  });

  test("a short, slow drag released cancels", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    drag(60);
    expect(lifted()).toHaveLength(2);
    touch("touchend", 60, 150);
    await settled();
    expect(location.pathname).toBe(at("/post"));
    expect(lifted()).toHaveLength(0);
    expect(shown().map(pageOf)).toEqual([at("/post")]);
  });

  test("a drag past 40% released goes back", async () => {
    app = mount();
    await scrolled(500);
    app.push(at("/post"));
    await settled();

    drag(innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6, 150);
    await settled();
    expect(location.pathname).toBe(at("/home"));
    expect(shown().map(pageOf)).toEqual([at("/home")]);
    expect(scrollY).toBe(500);
  });

  test("a quick flick goes back even short of 40%", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    // In one task: the speed is read over the last 100ms of moves, which a
    // frame of a loaded machine (a CI runner) can outlast.
    touch("touchstart", 5);
    touch("touchmove", 40);
    touch("touchmove", 120);
    touch("touchend", 120);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  // As iOS.
  test("a flick back toward the edge stays, though dragged past 40%", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    drag(innerWidth * 0.7);
    // Rested: only the flick is within the speed's last 100ms.
    touch("touchmove", innerWidth * 0.6, 150);
    touch("touchmove", innerWidth * 0.5);
    touch("touchend", innerWidth * 0.5);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("ten cancels in a row leave the page and the swipe as they were", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    for (let i = 0; i < 10; i++) {
      drag(40 + i * 8);
      touch("touchend", 40 + i * 8, 150);
      await settled();
      expect(location.pathname).toBe(at("/post"));
    }
    drag(innerWidth * 0.6);
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
    touch("touchmove", 15, 250);
    touch("touchmove", 110);
    touch("touchend", 110);
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("a drag that stops before the release stays (no speed left)", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    drag(120);
    touch("touchend", 120, 200);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a touch the system takes (touchcancel) stays, wherever the finger is", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();
    drag(innerWidth * 0.7);
    touch("touchcancel", innerWidth * 0.7);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("swipe as a function turns the edge off for the backs it refuses", async () => {
    app = mount({ swipe: (from) => (from.endsWith("/post") ? false : "edge") });
    app.push(at("/post"));
    await settled();
    drag(innerWidth * 0.6);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.6);

    app.push(at("/other"));
    await settled();
    drag(innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  // Whichever end the release decides, the window is already at the nearer
  // screen: aimed only at the end, a cancel's scroll met the drop (a blank
  // frame on iOS).
  test("the window follows the finger's nearer screen; dragged back to the edge, the drop does not scroll", async () => {
    app = mount();
    await scrolled(700);
    app.push(at("/post"));
    await settled();
    expect(scrollY).toBe(0);

    drag(innerWidth * 0.7);
    const stop = recordFrames();
    await until(() => scrollY === 700, "the window at the screen behind");
    for (let x = innerWidth * 0.7; x > 5; x -= 40) touch("touchmove", x);
    touch("touchmove", 5);
    await until(() => scrollY === 0, "the window back at the screen on top");
    // A finger's end comes in a frame after its last move (input runs before
    // the frame callbacks that seek).
    await frame();
    touch("touchend", 5, 150);
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(location.pathname).toBe(at("/post"));
  });

  test("a navigation while the finger is down ends the swipe on it, the touch then ignored", async () => {
    app = mount();
    app.push(at("/post"));
    await settled();

    drag(innerWidth * 0.5);
    app.push(at("/other"));
    touch("touchmove", innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6);
    await settled();
    expect(location.pathname).toBe(at("/other"));
    expect(shown().map(pageOf)).toEqual([at("/other")]);
  });

  test("a swipe back released past half drops the layers without scrolling", async () => {
    app = mount();
    await scrolled(700);
    app.push(at("/post"));
    await settled();
    drag(innerWidth * 0.6);
    const stop = recordFrames();
    await until(() => scrollY === 700, "the window at the screen behind");
    touch("touchend", innerWidth * 0.6, 150);
    await settled();
    expect(scrollsWhenDropping(stop())).toEqual([]);
    expect(scrollY).toBe(700);
  });

  // The window turns to a screen only past 55% of the way toward it: a finger
  // resting at half does not flip it, and scroll, every frame.
  test("the window turns to a screen only well past half", async () => {
    app = mount({ enableProgressCssVar: true });
    await scrolled(700);
    app.push(at("/post"));
    await settled();

    // The progress is written with each seek: the seek ran once it shows.
    const move = async (x: number) => {
      touch("touchmove", innerWidth * x);
      const shows = 1 - (innerWidth * x - 5) / innerWidth;
      await until(
        () => Math.abs(Number(progress()) - shows) < 0.001,
        `the seek at ${x}`,
      );
    };
    touch("touchstart", 5);
    await move(0.5);
    expect(scrollY).toBe(0);
    await move(0.6);
    expect(scrollY).toBe(700);
    await move(0.5);
    expect(scrollY).toBe(700);
    await move(0.4);
    expect(scrollY).toBe(0);
    touch("touchend", innerWidth * 0.4, 150);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("progress falls with the finger, rises once the back commits", async () => {
    app = mount({ enableProgressCssVar: true });
    app.push(at("/post"));
    await settled();

    touch("touchstart", 5);
    touch("touchmove", innerWidth * 0.3);
    // The router still renders /post, about a third of it slid out.
    await until(
      () => Math.abs(Number(progress()) - 0.7) < 0.05,
      "the progress of the finger",
    );

    touch("touchmove", innerWidth * 0.6);
    const committed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    touch("touchend", innerWidth * 0.6, 150);
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
    app = mount();
    app.push(at("/post"));
    await settled();

    const hidden: string[] = [];
    const hiddenLayer = (style: string | null | undefined) =>
      !!style?.includes("position: fixed") && style.includes("display: none");
    const check = (records: MutationRecord[]) => {
      for (const record of records) {
        const style = (record.target as HTMLElement).getAttribute("style");
        if (hiddenLayer(record.oldValue) || hiddenLayer(style))
          hidden.push(record.oldValue ?? "");
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
      attributeOldValue: true,
    });

    drag(innerWidth * 0.6);
    const committed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    touch("touchend", innerWidth * 0.6, 150);
    // The rest held mid-play: the commit lands while it still plays.
    slideAt(0.5);
    const at0 = lifted().map(offsetX);
    await committed;
    // Both screens' content still shown though React hid the one left, the
    // layers where they were (iOS rebuilt the animation: it jumped back).
    expect(lifted()).toHaveLength(2);
    expect(lifted().map(offsetX)).toEqual(at0);
    expect(
      lifted().every(
        (host) => getComputedStyle(contentOf(host)).display !== "none",
      ),
    ).toBe(true);
    finishSlide();
    await settled();
    check(observer.takeRecords());
    observer.disconnect();

    expect(location.pathname).toBe(at("/home"));
    expect(hidden).toEqual([]);
  });

  // A guard on the screen a back lands on sends it to where the back came from
  // (a login page, once logged in): the back ends where it started instead of
  // waiting for a commit of another screen forever.
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
      drag(innerWidth * 0.6);
      touch("touchend", innerWidth * 0.6, 150);
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
      if (loading) router.stale = at("/post");
    };
    addEventListener("popstate", pending);
    app = mount({ view: () => (router.stale === null ? "current" : "stale") });
    app.push(at("/post"));
    await settled();
    loading = true;
    try {
      drag(innerWidth * 0.6);
      const landed = new Promise((resolve) =>
        addEventListener("popstate", resolve, { once: true }),
      );
      touch("touchend", innerWidth * 0.6, 150);
      await landed;
      // Past the stack's own check a frame after the traversal, and the rest
      // played to its end: still waiting.
      await new Promise(requestAnimationFrame);
      await until(rested, "the rest played");
      // History is at /home; the router still renders /post.
      expect(location.pathname).toBe(at("/home"));
      expect(lifted()).toHaveLength(2);
    } finally {
      removeEventListener("popstate", pending);
      router.stale = null;
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

    drag(innerWidth * 0.6);
    const back = history.back;
    const calls: string[] = [];
    history.back = () => {
      calls.push("back");
      back.call(history);
    };
    try {
      touch("touchend", innerWidth * 0.6, 150);
      calls.push("released");
      expect(lifted()).toHaveLength(2);
      await until(() => calls.length === 2, "the back");
      expect(calls).toEqual(["released", "back"]);
    } finally {
      history.back = back;
    }
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });
});
