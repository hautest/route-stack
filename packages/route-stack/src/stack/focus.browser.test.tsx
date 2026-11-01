// Apart from Stack.browser.test.tsx: WebKit allows a document 100 history
// writes per 10 seconds, and that file comes close to it.
import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Stack } from "./Stack";
import {
  dispatchTouch,
  frame,
  frames,
  lifted,
  recordFrames,
  scrollsWhenDropping,
  settled,
} from "../test/browser";
import { ios } from "../transition/transitions";
import type { Transition } from "../types";

const fast: Transition = { ...ios, duration: 60 };

type How = "autoFocus" | "effect" | "layoutEffect";
// A field by path: at the top or far below, focused by autoFocus or in an
// effect.
const fields = new Map<string, { at: "top" | "bottom"; how: How }>();

function Field({ how }: { how: How }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (how === "effect") ref.current?.focus();
  }, [how]);
  useLayoutEffect(() => {
    if (how === "layoutEffect") ref.current?.focus();
  }, [how]);
  return <input ref={ref} data-field="" autoFocus={how === "autoFocus"} />;
}

// `lag`: the router renders a back that long after history moved (loaders).
function mount(duration = fast.duration, lag = 0) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = location.pathname;
    const field = fields.get(path);
    flushSync(() =>
      root.render(
        <Stack animate={() => ({ ...fast, duration })} path={path}>
          <div style={{ height: "3000px" }} data-page={path}>
            {field?.at === "top" && <Field how={field.how} />}
            {path}
            {field?.at === "bottom" && (
              <div style={{ marginTop: "2000px" }}>
                <Field how={field.how} />
              </div>
            )}
          </div>
        </Stack>,
      ),
    );
  };
  const onPop = () => (lag ? setTimeout(render, lag) : render());
  addEventListener("popstate", onPop);
  render();
  return {
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

const field = () =>
  document.querySelector<HTMLInputElement>(
    `[data-page="${location.pathname}"] [data-field]`,
  )!;
const inView = (el: Element) => {
  const { top, bottom } = el.getBoundingClientRect();
  return top >= 0 && bottom <= innerHeight;
};

// From the left edge past half of the screen, released: a back.
async function swipeBack() {
  const target = document.querySelector(`[data-page="${location.pathname}"]`)!;
  dispatchTouch(target, "touchstart", 5);
  for (let i = 1; i <= 6; i++) {
    dispatchTouch(target, "touchmove", 5 + ((innerWidth * 0.6 - 5) * i) / 6);
    await frame();
  }
  dispatchTouch(target, "touchend", innerWidth * 0.6);
}

let app: ReturnType<typeof mount> | null = null;
let base = "";
let run = 0;
const at = (path: string) => `${base}${path}`;

// The window aimed only at the end (late-scroll) blanked on an iPhone: a focus
// must be folded in while the layers are up.
const logged: string[] = [];
const SINK = Symbol.for("route-stack.log");

beforeEach(() => {
  base = `/focus-${++run}`;
  history.replaceState(null, "", at("/home"));
  (globalThis as Record<symbol, unknown>)[SINK] = (event: string) =>
    logged.push(event);
});

afterEach(() => {
  fields.clear();
  app?.unmount();
  app = null;
  scrollTo(0, 0);
  delete (globalThis as Record<symbol, unknown>)[SINK];
  const late = logged.splice(0).filter((event) => event === "late-scroll");
  expect(late).toEqual([]);
});

for (const how of ["autoFocus", "effect"] as const)
  for (const where of ["top", "bottom"] as const)
    test(`a pushed screen's ${how} field at its ${where} keeps the focus, in view`, async () => {
      fields.set(at("/post"), { at: where, how });
      // Long enough to look mid-slide on a slow machine too (a CI runner).
      app = mount(1000);
      const drops = recordFrames();
      app.push(at("/post"));
      // Mid-slide a focus that scrolled the layer is already the window's
      // (the drop would otherwise undo it, a jump).
      await frames(2);
      expect(lifted()).toHaveLength(2);
      expect(lifted().map((host) => host.scrollTop)).toEqual([0, 0]);
      expect(inView(field())).toBe(true);
      await settled();
      await frames(3);

      expect(document.activeElement).toBe(field());
      expect(inView(field())).toBe(true);
      expect(scrollY > 0).toBe(where === "bottom");
      expect(scrollsWhenDropping(drops())).toEqual([]);
    });

// The screen comes back where it was left, focused or not: shown by a margin,
// the layer has no scroll up to a field above.
test("a screen back that focuses a field above its scroll keeps its scroll", async () => {
  fields.set(at("/home"), { at: "top", how: "effect" });
  app = mount();
  await frame();
  // WebKit holds the window at a focused field: scrolled with none, the
  // effect focuses it again when the screen comes back.
  field().blur();
  scrollTo(0, 1200);
  await frame();
  app.push(at("/post"));
  await settled();

  const drops = recordFrames();
  await app.back();
  await settled();
  await frames(3);
  expect(document.activeElement).toBe(field());
  expect(scrollY).toBe(1200);
  expect(scrollsWhenDropping(drops())).toEqual([]);
});

// A redirect while sliding in lifts its own screen: it takes focus too, and a
// field far below is where the slide ends.
for (const where of ["top", "bottom"] as const)
  test(`a screen a redirect slides in keeps its autoFocus at its ${where}, in view`, async () => {
    fields.set(at("/login"), { at: where, how: "autoFocus" });
    app = mount(300);
    app.push(at("/post"));
    await frame();
    app.replace(at("/login"));
    await settled();
    await frames(3);

    expect(document.activeElement).toBe(field());
    expect(inView(field())).toBe(true);
  });

// The screen behind a swipe takes focus once its back commits, and a field
// far below it focused then is where the slide ends.
for (const how of ["effect", "layoutEffect"] as const)
  test(`a swipe back to a screen that focuses a field far below in an ${how} ends there`, async () => {
    fields.set(at("/home"), { at: "bottom", how });
    app = mount(300);
    field().blur();
    scrollTo(0, 0);
    await frame();
    app.push(at("/post"));
    await settled();

    const drops = recordFrames();
    await swipeBack();
    await settled();
    await frames(3);

    expect(location.pathname).toBe(at("/home"));
    expect(document.activeElement).toBe(field());
    expect(inView(field())).toBe(true);
    expect(scrollsWhenDropping(drops())).toEqual([]);
  });

// The back commits after its slide rested: the focus of that commit scrolls
// the layer still lifted, its scroll event maybe not come when the slide ends.
test("a swipe back committed after its slide rested ends at the field it focuses", async () => {
  fields.set(at("/home"), { at: "bottom", how: "layoutEffect" });
  app = mount(150, 400);
  field().blur();
  scrollTo(0, 0);
  await frame();
  app.push(at("/post"));
  await settled();

  // Frame callbacks of one frame share the timeline's time: the layers must
  // not drop in a frame that also scrolls the window.
  const now = () => Number(document.timeline.currentTime);
  let dropped = 0;
  const scrolled: number[] = [];
  const observer = new MutationObserver(() => {
    if (!dropped && !lifted().length) dropped = now();
  });
  const windowScroll = window.scrollTo;
  window.scrollTo = ((x: number, y: number) => {
    if (Math.round(y) !== Math.round(scrollY)) scrolled.push(now());
    windowScroll.call(window, x, y);
  }) as typeof window.scrollTo;
  try {
    await swipeBack();
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["style"],
    });
    await settled();
    await frames(3);
  } finally {
    observer.disconnect();
    window.scrollTo = windowScroll;
  }

  expect(location.pathname).toBe(at("/home"));
  expect(document.activeElement).toBe(field());
  expect(inView(field())).toBe(true);
  expect(dropped).toBeGreaterThan(0);
  expect(scrolled).not.toContain(dropped);
  // The window aimed a frame before the drop, where the scroll event came late.
  logged.splice(0);
});
