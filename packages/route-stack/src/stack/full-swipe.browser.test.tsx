import { describe, expect, test } from "vitest";
import {
  dispatchTouch,
  lifted,
  settled,
  type TouchOptions,
} from "../test/browser";
import { at, mount, setupStack } from "../test/stack";
import type { StackProps } from "../types";

setupStack();

let app: ReturnType<typeof mount> | null = null;

const page = () =>
  document.querySelector<HTMLElement>(`[data-page="${location.pathname}"]`)!;

describe("full-screen swipe", () => {
  let target: Element | null = null;
  let now = 0;
  const touch = (
    type: string,
    x: number,
    y = 300,
    { dt = 16, ...options }: TouchOptions & { dt?: number } = {},
  ) => {
    if (type === "touchstart") target = options.on ?? page();
    if (!target) throw new Error("no touch started");
    return dispatchTouch(target, type, x, y, { ...options, at: (now += dt) });
  };
  // Past the slop, then to `to`.
  const drag = (from: number, to: number, on?: Element) => {
    touch("touchstart", from, 300, { on });
    for (let i = 1; i <= 4; i++)
      touch("touchmove", from + ((to - from) * i) / 4);
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
    drag(innerWidth * 0.3, innerWidth * 0.9);
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
      drag(5, innerWidth * 0.6);
      expect(lifted()).toHaveLength(0);
      touch("touchend", innerWidth * 0.6);
    }));

  // An explicit `swipe` overrides Android's default `false`.
  test('"full" swipes on Android too', () =>
    onAndroid(async () => {
      await pushed();
      drag(innerWidth * 0.3, innerWidth * 0.9);
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
    for (const x of [0.5, 0.65, 0.8])
      expect(touch("touchmove", innerWidth * x, 340).defaultPrevented).toBe(
        true,
      );
    expect(lifted()).toHaveLength(2);
    touch("touchend", innerWidth * 0.8, 300, { dt: 150 });
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  // Past 40% of the width was out of reach from the right of the screen.
  test("a slow drag from the right goes back once it covered 40% of its way", async () => {
    await pushed();
    drag(innerWidth * 0.7, innerWidth * 0.95);
    touch("touchend", innerWidth * 0.95, 300, { dt: 150 });
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });

  test("a drag brought back to where it touched stays", async () => {
    await pushed();
    drag(innerWidth * 0.6, innerWidth * 0.9);
    touch("touchmove", innerWidth * 0.6);
    touch("touchend", innerWidth * 0.6, 300, { dt: 150 });
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a vertical move first is the page's: not cancelled, no swipe after", async () => {
    await pushed();
    touch("touchstart", 100);
    expect(touch("touchmove", 102, 330).defaultPrevented).toBe(false);
    touch("touchmove", 300, 330);
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300, 330);
  });

  test("a move the browser no longer lets cancel (it scrolls) starts nothing", async () => {
    await pushed();
    touch("touchstart", 100);
    touch("touchmove", 130, 300, { cancelable: false });
    touch("touchmove", 300);
    expect(lifted()).toHaveLength(0);
    touch("touchend", 300);
  });

  test("the system taking the touch (touchcancel) mid-drag stays", async () => {
    await pushed();
    drag(100, innerWidth * 0.8);
    touch("touchcancel", innerWidth * 0.8);
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("a second finger cancels the swipe", async () => {
    await pushed();
    drag(100, innerWidth * 0.5);
    touch("touchstart", 200, 300, { id: 2, fingers: 2 });
    await settled();
    expect(location.pathname).toBe(at("/post"));
  });

  test("an element declaring its own horizontal pan keeps it; above the screen it does not count", async () => {
    await pushed();
    page().style.touchAction = "pan-y";
    drag(100, innerWidth * 0.8);
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
      drag(100, innerWidth * 0.8);
      expect(lifted()).toHaveLength(2);
      touch("touchend", innerWidth * 0.8, 300, { dt: 150 });
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
    drag(100, innerWidth * 0.8, wide);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);

    scroller.scrollLeft = 0;
    drag(100, innerWidth * 0.8, wide);
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
      drag(100, innerWidth * 0.8, on);
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
      drag(100, innerWidth * 0.8, on);
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
    drag(5, innerWidth * 0.8, field);
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
      drag(5, innerWidth * 0.8, host.firstElementChild!);
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
    drag(100, innerWidth * 0.8, host.shadowRoot!.querySelector("span")!);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);
  });

  // A sheet portaled out of the screen keeps its drags.
  test("a touch outside the shown screen starts nothing", async () => {
    await pushed();
    const sheet = document.createElement("div");
    document.body.append(sheet);
    try {
      drag(100, innerWidth * 0.8, sheet);
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
    drag(100, innerWidth * 0.8);
    expect(lifted()).toHaveLength(0);
    touch("touchend", innerWidth * 0.8);

    drag(5, innerWidth * 0.8);
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
    drag(100, innerWidth * 0.5, child);
    child.remove();
    touch("touchmove", innerWidth * 0.8);
    touch("touchend", innerWidth * 0.8, 300, { dt: 150 });
    await settled();
    expect(location.pathname).toBe(at("/home"));
  });
});
