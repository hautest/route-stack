// The stack's browser tests, in files of their own: WebKit allows a page 100
// history writes per 10 seconds, and each file is a page of its own (CI).
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { Stack } from "../stack/Stack";
import { contentOf } from "../transition/layers";
import { ios } from "../transition/transitions";
import type { AdapterProps, StackProps, Transition } from "../types";
import { hosts, lifted } from "./browser";

export const fast: Transition = { ...ios, duration: 60 };

// Page height by path, for pages whose content changes height (a refetch
// shows a shorter skeleton).
export const heights = new Map<string, number>();

// A path the router still renders though history has moved (its loaders
// pending), or null: it renders the URL.
export const router = { stale: null as string | null };

// A minimal router: history is the source, the stack renders whatever the URL
// says.
export function mount(
  props: Partial<StackProps & AdapterProps> = {},
  { strict = false } = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = router.stale ?? location.pathname + location.search;
    const page = (
      <div
        style={{ height: `${heights.get(path) ?? 3000}px` }}
        data-page={path}
      >
        {path}
        {/* An in-screen floating button. */}
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
  const app = {
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
      if (!mounted.delete(app)) return;
      removeEventListener("popstate", onPop);
      root.unmount();
      container.remove();
    },
  };
  mounted.add(app);
  return app;
}
// Unmounted after each test.
const mounted = new Set<{ unmount(): void }>();

// React hides a screen's content; the screen element itself is the layer.
export const shown = () =>
  hosts().filter(
    (host) => getComputedStyle(contentOf(host)).display !== "none",
  );
export const offsetX = (el: HTMLElement) =>
  new DOMMatrix(getComputedStyle(el).transform).m41;
export const pageOf = (host: HTMLElement) =>
  host.querySelector("[data-page]")?.getAttribute("data-page");

export const progress = () =>
  document.documentElement.style.getPropertyValue("--route-stack-progress");

// The progress at every frame until the slide settles, unset ones left out.
export async function progressUntilSettled() {
  const values: number[] = [];
  while (lifted().length) {
    if (progress()) values.push(Number(progress()));
    await new Promise(requestAnimationFrame);
  }
  return values;
}

let base = "";
let run = 0;
export const at = (path: string) => `${base}${path}`;

// The window aimed only at the end (late-scroll) is the fallback that still
// blanked on an iPhone: a slide must never need it.
export const logged: string[] = [];
export const SINK = Symbol.for("route-stack.log");

// The hooks every stack test file needs: a fresh path per test, the stack
// unmounted after it, and the checks every slide must pass.
export function setupStack() {
  // Every play must run forward: a negative playbackRate (or reverse())
  // finishes at once in iOS WebKit, so a cancel snapped back without sliding.
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
    for (const app of [...mounted]) app.unmount();
    scrollTo(0, 0);
  });
}
