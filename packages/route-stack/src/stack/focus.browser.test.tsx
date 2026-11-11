// A file of its own: WebKit allows a page 100 history writes per 10 seconds
// (see test/stack.tsx).
import { useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Stack } from "./Stack";
import {
  dispatchTouch,
  finishSlide,
  lifted,
  pauseSlide,
  recordFrames,
  rested,
  scrolled,
  scrollsWhenDropping,
  settled,
  slideAt,
  until,
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

// `lagged`: the router renders a back only when told (`flush`), as one whose
// loaders run.
function mount({ lagged = false } = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = location.pathname;
    const field = fields.get(path);
    flushSync(() =>
      root.render(
        <Stack animate={() => fast} path={path}>
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
  let late: (() => void) | null = null;
  const onPop = () => (lagged ? (late = render) : render());
  addEventListener("popstate", onPop);
  render();
  return {
    flush() {
      late?.();
      late = null;
    },
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

// From the left edge past half of the screen, released: a back. A frame
// between events (their times).
function swipeBack() {
  const target = document.querySelector(`[data-page="${location.pathname}"]`)!;
  let at = 0;
  dispatchTouch(target, "touchstart", 5, 300, { at });
  for (let i = 1; i <= 6; i++)
    dispatchTouch(
      target,
      "touchmove",
      5 + ((innerWidth * 0.6 - 5) * i) / 6,
      300,
      {
        at: (at += 16),
      },
    );
  dispatchTouch(target, "touchend", innerWidth * 0.6, 300, { at: at + 16 });
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
      app = mount();
      app.push(at("/post"));
      const drops = recordFrames();
      pauseSlide();
      // Mid-slide a focus that scrolled the layer is already the window's
      // (the drop would otherwise undo it, a jump).
      await until(
        () =>
          document.activeElement === field() &&
          lifted().length === 2 &&
          lifted().every((host) => host.scrollTop === 0) &&
          inView(field()),
        "the focus folded into the window",
      );
      expect(lifted()).toHaveLength(2);
      finishSlide();
      await settled();
      await until(
        () => document.activeElement === field() && inView(field()),
        "the focus, in view",
      );

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
  await until(() => document.activeElement === field(), "the focus");
  // WebKit holds the window at a focused field: scrolled with none, the
  // effect focuses it again when the screen comes back.
  field().blur();
  await scrolled(1200);
  app.push(at("/post"));
  await settled();

  await app.back();
  const drops = recordFrames();
  await settled();
  await until(() => document.activeElement === field(), "the focus");
  expect(scrollY).toBe(1200);
  expect(scrollsWhenDropping(drops())).toEqual([]);
});

// A redirect while sliding in lifts its own screen: it takes focus too, and a
// field far below is where the slide ends.
for (const where of ["top", "bottom"] as const)
  test(`a screen a redirect slides in keeps its autoFocus at its ${where}, in view`, async () => {
    fields.set(at("/login"), { at: where, how: "autoFocus" });
    app = mount();
    app.push(at("/post"));
    slideAt(0.5);
    app.replace(at("/login"));
    finishSlide();
    await settled();
    await until(
      () => document.activeElement === field() && inView(field()),
      "the focus, in view",
    );
    expect(inView(field())).toBe(true);
  });

// The screen behind a swipe takes focus once its back commits, and a field
// far below it focused then is where the slide ends.
for (const how of ["effect", "layoutEffect"] as const)
  test(`a swipe back to a screen that focuses a field far below in an ${how} ends there`, async () => {
    fields.set(at("/home"), { at: "bottom", how });
    app = mount();
    await until(() => document.activeElement === field(), "the focus");
    field().blur();
    await scrolled(0);
    app.push(at("/post"));
    await settled();

    swipeBack();
    const drops = recordFrames();
    await settled();
    await until(
      () => document.activeElement === field() && inView(field()),
      "the focus, in view",
    );

    expect(location.pathname).toBe(at("/home"));
    expect(document.activeElement).toBe(field());
    expect(inView(field())).toBe(true);
    expect(scrollsWhenDropping(drops())).toEqual([]);
  });

// The back commits after its slide rested: the focus of that commit scrolls
// the layer still lifted, its scroll event maybe not come when the slide ends.
test("a swipe back committed after its slide rested ends at the field it focuses", async () => {
  fields.set(at("/home"), { at: "bottom", how: "layoutEffect" });
  app = mount({ lagged: true });
  await until(() => document.activeElement === field(), "the focus");
  field().blur();
  await scrolled(0);
  app.push(at("/post"));
  await settled();

  // Frame callbacks of one frame share the timeline's time: the layers must
  // not drop in a frame that also scrolls the window.
  const now = () => Number(document.timeline.currentTime);
  let dropped = 0;
  const scrolls: number[] = [];
  const observer = new MutationObserver(() => {
    if (!dropped && !lifted().length) dropped = now();
  });
  const windowScroll = window.scrollTo;
  window.scrollTo = ((options: ScrollToOptions) => {
    if (Math.round(options.top ?? 0) !== Math.round(scrollY))
      scrolls.push(now());
    (windowScroll as (options: ScrollToOptions) => void).call(window, options);
  }) as typeof window.scrollTo;
  try {
    const landed = new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
    swipeBack();
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["style"],
    });
    // The back commits only once its slide rested.
    await landed;
    await until(rested, "the slide rested");
    expect(lifted()).toHaveLength(2);
    app.flush();
    await settled();
    await until(
      () => document.activeElement === field() && inView(field()),
      "the focus, in view",
    );
  } finally {
    observer.disconnect();
    window.scrollTo = windowScroll;
  }

  expect(location.pathname).toBe(at("/home"));
  expect(document.activeElement).toBe(field());
  expect(inView(field())).toBe(true);
  expect(dropped).toBeGreaterThan(0);
  expect(scrolls).not.toContain(dropped);
  // When the scroll event came late, the window was aimed a frame before the
  // drop (a late-scroll), as it should.
  logged.splice(0);
});
