import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  Entries,
  Entry,
  NavigationEvent,
  Tracked,
} from "../history/index";
import { createScreenMap, defaultSameScreen } from "../history/screens";
import type { Drag } from "../swipe/swipe";
import type { Layer } from "../transition/layers";
import type { SameScreen, View } from "../types";
import { Core, type Render } from "./core";

// The DOM side of the core, faked: slides record their commands and finish
// when told, the swipe hands over its `begin` and records where it opens, the window is a number.
const fake = vi.hoisted(() => ({
  slides: [] as FakeSlide[],
  begin: null as (() => Drag | null) | null,
  firstScroll: 0,
  forgets: 0,
  opens: [] as ("edge" | "screen" | null)[],
}));

interface FakeSlide {
  enter: number | null;
  leave: number | null;
  back: boolean;
  ended: boolean;
  progress: number;
  calls: string[];
  finish(): void;
}

const idOf = (layer: Layer | null) =>
  layer && (layer.host as unknown as { id: number }).id;

vi.mock("../transition/slide", () => ({
  slide(enter: Layer, leave: Layer, _transition: unknown, back: boolean) {
    let finish = () => {};
    const control = {
      enter: idOf(enter),
      leave: idOf(leave),
      back,
      ended: false,
      progress: 0,
      calls: [] as string[],
      finish: () => finish(),
      seek(progress: number) {
        control.progress = progress;
        control.calls.push(`seek ${progress}`);
      },
      play(forward: boolean) {
        control.calls.push(`play ${forward ? "enter" : "leave"}`);
        return new Promise<boolean>((resolve) => {
          finish = () => {
            control.progress = forward ? 1 : 0;
            resolve(!control.ended);
          };
        });
      },
      aim: (side: string) => control.calls.push(`aim ${side}`),
      retarget: (layer: Layer) =>
        control.calls.push(`retarget ${idOf(layer)} at ${layer.scroll}`),
      reveal: () => control.calls.push("reveal"),
      end(current: Layer | null, now?: boolean) {
        control.ended = true;
        control.calls.push(`end ${idOf(current)}${now ? " now" : ""}`);
      },
    };
    fake.slides.push(control);
    return control;
  },
}));

vi.mock("../swipe/swipe", () => ({
  listenSwipe(begin: () => Drag | null) {
    fake.begin = begin;
    return {
      open(area: { fullScreen: boolean } | null) {
        fake.opens.push(area && area.fullScreen ? "screen" : area && "edge");
      },
      forget() {
        fake.forgets++;
      },
      dispose() {},
    };
  },
}));

vi.mock("../transition/layers", () => ({
  firstScroll: () => fake.firstScroll,
}));

vi.mock("./progress", () => ({
  ProgressVar: class {
    enabled = false;
    write() {}
    clear() {}
    track() {}
  },
}));

// ---------- the window

let frames: (() => void)[] = [];
const frame = () => {
  const due = frames;
  frames = [];
  for (const callback of due) callback();
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const win = { y: 0 };
let onScroll = () => {};
let onPageHide: (() => void) | null = null;
let onVisibility: (() => void) | null = null;
const page = { visibilityState: "visible" as DocumentVisibilityState };
const logged: { event: string; data?: Record<string, unknown> | undefined }[] =
  [];
const events = (event: string) =>
  logged.filter((entry) => entry.event === event);
const SINK = Symbol.for("route-stack.log");

beforeEach(() => {
  frames = [];
  win.y = 0;
  logged.length = 0;
  fake.slides = [];
  fake.begin = null;
  fake.firstScroll = 0;
  fake.forgets = 0;
  fake.opens = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("scrollTo", (_x: number, y: number) => (win.y = y));
  Object.defineProperty(globalThis, "scrollY", {
    get: () => win.y,
    configurable: true,
  });
  onPageHide = null;
  onVisibility = null;
  page.visibilityState = "visible";
  vi.stubGlobal("document", {
    get visibilityState() {
      return page.visibilityState;
    },
    addEventListener(type: string, listener: () => void) {
      if (type === "visibilitychange") onVisibility = listener;
    },
    removeEventListener(type: string) {
      if (type === "visibilitychange") onVisibility = null;
    },
  });
  vi.stubGlobal("addEventListener", (type: string, listener: () => void) => {
    if (type === "scroll") onScroll = listener;
    if (type === "pagehide") onPageHide = listener;
  });
  vi.stubGlobal("removeEventListener", (type: string) => {
    if (type === "pagehide") onPageHide = null;
  });
  vi.stubGlobal("history", { scrollRestoration: "auto" });
  (globalThis as Record<symbol, unknown>)[SINK] = (
    event: string,
    data?: Record<string, unknown>,
  ) => logged.push({ event, data });
});

const mounted: Core[] = [];

afterEach(() => {
  for (const core of mounted.splice(0)) core.detach();
  vi.unstubAllGlobals();
  delete (globalThis as Record<symbol, unknown>)[SINK];
});

// ---------- history: entries in a list, the screen map folding its events

/** `base`: a base path history's URLs have and the stack's paths not. */
function fakeHistory(path = "/home", base = "") {
  const url = (to: string) => `https://app.test${base}${to}`;
  let list: Entry[] = [{ key: "k0", index: 0, url: url(path) }];
  let at = 0;
  let seq = 0;
  let backs = 0;
  let lookups = 0;
  const listeners = new Set<(event: NavigationEvent) => void>();
  const current = () => list[at]!;
  const emit = (type: NavigationEvent["type"], from: Entry) => {
    for (const listener of [...listeners])
      listener({ type, from, to: current() });
  };

  const entries: Entries = {
    current,
    indexOf(key) {
      lookups++;
      return list.find((entry) => entry.key === key)?.index ?? null;
    },
    // As a browser: the traversal lands in a later task (land()).
    back: () => backs++,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const { apply, ...screens } = createScreenMap(entries);
  entries.subscribe(apply);

  const go = (delta: number) => {
    const from = current();
    at += delta;
    emit("traverse", from);
  };

  return {
    tracked: { ...entries, ...screens } satisfies Tracked,
    push(to: string) {
      const from = current();
      list = [
        ...list.slice(0, at + 1),
        { key: `k${++seq}`, index: ++at, url: url(to) },
      ];
      emit("push", from);
    },
    /** `newKey`: as WebKit's Navigation API replaces. */
    replace(to: string, newKey = false) {
      const from = current();
      list[at] = {
        key: newKey ? `k${++seq}` : from.key,
        index: at,
        url: url(to),
      };
      emit("replace", from);
    },
    go,
    /** The traversal of a back() sent lands. */
    land() {
      if (!backs) throw new Error("no back sent");
      backs--;
      go(-1);
    },
    /** As Chromium past 50 entries: the oldest go, the others renumbered. */
    renumber(dropped: number) {
      list = list
        .slice(dropped)
        .map((entry) => ({ ...entry, index: entry.index - dropped }));
      at -= dropped;
    },
    get backs() {
      return backs;
    },
    get lookups() {
      return lookups;
    },
    get key() {
      return current().key;
    },
  };
}

// ---------- a stack over it, rendered by a router reporting `view`

function mount(
  path = "/home",
  sameScreen: SameScreen = defaultSameScreen,
  base = "",
) {
  const history = fakeHistory(path, base);
  const core = new Core(history.tracked);
  mounted.push(core);
  const rerender = vi.fn();
  core.update({
    animate: () => ({}) as never,
    progress: false,
    swipe: () => "edge",
    sameScreen,
  });
  core.attach({
    host: (id) => ({ id }) as unknown as HTMLElement,
    rerender,
  });
  const stop = core.listen(true);

  /** A render and its commit; `ahead` read at render, `view` at commit. */
  const render = (
    to: string,
    view: View = "current",
    ahead: View | null = null,
  ) => {
    let read: View = ahead ?? view;
    const r: Render = { path: to, view: () => read };
    const id = core.resolve(r);
    read = view;
    core.commit(id, r);
    return id;
  };

  const home = render(path);
  return { history, core, rerender, render, home, stop };
}

const shownPaths = (core: Core) => core.screens().map((screen) => screen.path);
const slide = (index = -1) => fake.slides.at(index)!;

/** A push of `to`, played to its end. */
async function pushed(stack: ReturnType<typeof mount>, to: string) {
  stack.history.push(to);
  const id = stack.render(to);
  slide().finish();
  await flush();
  return id;
}

/** A swipe from the edge to `progress`, released. */
function swipe(back: boolean, progress = back ? 0.6 : 0.2) {
  const drag = fake.begin!()!;
  drag.seek(progress);
  drag.release(back, progress);
  return slide();
}

describe("R1 resolve", () => {
  test("a path the stack has no screen for is a new screen, the same at every render until committed", () => {
    const { core, history } = mount();
    history.push("/post");
    const r = { path: "/post", view: () => "current" as const };
    expect(core.resolve(r)).toBe(core.resolve(r));
    expect(shownPaths(core)).toEqual(["/post", "/home"]);
  });

  test("a same-pathname replace keeps the screen, a query push is a new one", async () => {
    const stack = mount("/search?q=a");
    stack.history.replace("/search?q=b");
    expect(stack.render("/search?q=b")).toBe(stack.home);
    expect(shownPaths(stack.core)).toEqual(["/search?q=b"]);
    expect(events("commit")).toEqual([]);

    const next = await pushed(stack, "/search?q=c");
    expect(next).not.toBe(stack.home);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
    ]);
  });

  // A route normalizing its query in an effect (a default sort) on a deep link.
  test("a replace right after the first render keeps the screen, without a slide", () => {
    const stack = mount("/search/results?q=x");
    stack.history.replace("/search/results?q=x&sort=new");
    expect(stack.render("/search/results?q=x&sort=new")).toBe(stack.home);
    expect(fake.slides).toHaveLength(0);
    expect(events("commit")).toEqual([]);
  });

  const queryIsNew: SameScreen = (from, to) =>
    from.split("#")[0] === to.split("#")[0];

  test("sameScreen can make a query replace a new screen, played as a replace", async () => {
    const stack = mount("/search?q=a", queryIsNew);
    stack.history.replace("/search?q=b");
    const next = stack.render("/search?q=b");
    expect(next).not.toBe(stack.home);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "replace",
    ]);
    slide().finish();
    await flush();
    expect(shownPaths(stack.core)).toEqual(["/search?q=b"]);
  });

  test("sameScreen can keep another pathname on the screen", () => {
    const stack = mount(
      "/feed/new",
      (from, to) => from.startsWith("/feed/") && to.startsWith("/feed/"),
    );
    stack.history.push("/feed/hot");
    expect(stack.render("/feed/hot")).toBe(stack.home);
    expect(shownPaths(stack.core)).toEqual(["/feed/hot"]);
  });

  // Set on the render of a navigation: the screen map and resolve both use the
  // last commit's rule.
  test("a rule changed on the render of a navigation applies from the next one", () => {
    const stack = mount("/search?q=a", queryIsNew);
    stack.history.replace("/search?q=b");
    stack.core.update({
      animate: () => ({}) as never,
      progress: false,
      swipe: () => "edge",
      sameScreen: () => true,
    });
    expect(stack.render("/search?q=b")).not.toBe(stack.home);
    expect(stack.core.screens()).toHaveLength(2);
  });

  // A router that renders before it writes history (Next) tells the kind.
  const ahead = (path: string, type: "push" | "replace", base = "") => ({
    path,
    view: (): View => ({ ahead: type, url: `https://app.test${base}${path}` }),
  });

  test("ahead: a query push is a new screen, a query replace the same one, as sameScreen says", () => {
    const stack = mount("/list?page=1");
    expect(stack.core.resolve(ahead("/list?page=2", "push"))).not.toBe(
      stack.home,
    );
    expect(stack.core.resolve(ahead("/list?page=2", "replace"))).toBe(
      stack.home,
    );

    const queryNew = mount("/list?page=1", queryIsNew);
    expect(queryNew.core.resolve(ahead("/list?page=2", "replace"))).not.toBe(
      queryNew.home,
    );
  });

  test("ahead: sameScreen gets the URLs as history has them", () => {
    const calls: string[][] = [];
    const stack = mount(
      "/list?page=1",
      (from, to, type) => {
        calls.push([from, to, type]);
        return false;
      },
      "/app",
    );
    stack.history.replace("/list?page=1#top");
    stack.render("/list?page=1");
    calls.length = 0;
    stack.core.resolve({
      path: "/list?page=2",
      view: () => ({
        ahead: "replace",
        url: "https://app.test/app/list?page=2#end",
      }),
    });
    expect(calls).toContainEqual([
      "/app/list?page=1#top",
      "/app/list?page=2#end",
      "replace",
    ]);
  });

  // Next's basePath: the URL hinted is history's, as the screen map gets it.
  test("ahead under a base path: a query replace is one screen for one history screen", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const stack = mount("/search?q=a", defaultSameScreen, "/app");
    const id = stack.core.resolve(ahead("/search?q=ab", "replace", "/app"));
    expect(id).toBe(stack.home);
    stack.history.replace("/search?q=ab");
    stack.core.commit(id, { path: "/search?q=ab", view: () => "current" });
    expect(stack.core.screens()).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test("ahead at the commit is not the current entry yet: the new screen stays pending", () => {
    const stack = mount("/list?page=1");
    const { view } = ahead("/list?page=2", "push");
    const id = stack.render("/list?page=2", view(), view());
    expect(events("commit")).toEqual([]);
    expect(stack.core.screens().map((screen) => screen.id)).toEqual([
      id,
      stack.home,
    ]);

    stack.history.push("/list?page=2");
    expect(stack.render("/list?page=2", "current", view())).toBe(id);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
    ]);
  });
});

describe("R2 commit", () => {
  test("a stale render changes nothing: a back stays a back", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    logged.length = 0;

    // History is back on /home while the router still renders the post.
    stack.history.go(-1);
    expect(stack.render("/post", "stale")).toBe(post);
    expect(events("commit")).toEqual([]);

    expect(stack.render("/home")).toBe(stack.home);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "back",
    ]);
  });

  // A router whose loaders run after history moved (React Router, TanStack's
  // pending matches) still draws the screen left.
  test("a stale render of the screen left after a push does not take the new entry", async () => {
    const stack = mount();
    await pushed(stack, "/a");
    logged.length = 0;

    stack.history.push("/b");
    stack.render("/a", "stale");
    stack.render("/b");
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
    ]);
  });

  // An app whose path lags history by a task: an update in between renders
  // the screen left and calls it current. Drawn into the hidden screen, /post
  // would land in /home's element and /home get a second screen.
  test("a current render at another pathname does not take a hidden screen's entry", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    stack.history.go(-1);

    expect(stack.render("/post")).toBe(post);
    expect(shownPaths(stack.core)).toEqual(["/post", "/home"]);

    expect(stack.render("/home")).toBe(stack.home);
    expect(shownPaths(stack.core)).toEqual(["/post", "/home"]);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
      "back",
    ]);
  });

  // /a, /b, /a faster than the router renders: only the last is drawn.
  test("the shown screen drawn for an entry no screen shows absorbs it: the next back is a back", async () => {
    const stack = mount();
    const a = await pushed(stack, "/a");
    stack.history.push("/b");
    stack.history.push("/a");
    expect(stack.render("/a")).toBe(a);
    logged.length = 0;

    stack.history.go(-1);
    stack.render("/b");
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "back",
    ]);
    expect(slide()).toMatchObject({ leave: a, back: true });
  });

  test("a replace that gave the entry a new key (WebKit) is still a replace", async () => {
    const stack = mount();
    await pushed(stack, "/me");
    logged.length = 0;
    stack.history.replace("/login", true);
    stack.render("/login");
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "replace",
    ]);
  });
});

describe("R4 a change at rest", () => {
  test("a push slides from the shown screen, then settles on the new one at its first scroll", async () => {
    const stack = mount();
    fake.firstScroll = 1200;
    const doc = await pushed(stack, "/doc#sec");
    expect(slide()).toMatchObject({
      enter: doc,
      leave: stack.home,
      back: false,
    });
    expect(slide().calls).toEqual(["aim enter", "play enter", `end ${doc}`]);
    expect(events("settle")).toHaveLength(1);
    expect(win.y).toBe(1200);
  });

  test("animate false switches screens without a slide", () => {
    const stack = mount();
    stack.core.update({
      animate: () => false,
      progress: false,
      swipe: () => "edge",
      sameScreen: defaultSameScreen,
    });
    stack.history.push("/post");
    stack.render("/post");
    expect(fake.slides).toEqual([]);
    expect(events("settle")).toHaveLength(1);
  });

  test("a kept screen arrived at again keeps its saved scroll, not its first one", async () => {
    const stack = mount();
    fake.firstScroll = 1200;
    win.y = 700;
    onScroll();
    const post = await pushed(stack, "/post");
    expect(win.y).toBe(1200);
    stack.history.go(-1);
    stack.render("/home");
    expect(slide()).toMatchObject({
      enter: stack.home,
      leave: post,
      back: true,
    });
    slide().finish();
    await flush();
    expect(win.y).toBe(700);
  });
});

describe("R5 retarget", () => {
  test("a redirect to a #fragment opens at its element, as R4", async () => {
    const stack = mount();
    stack.history.push("/me");
    stack.render("/me");
    fake.firstScroll = 1200;
    stack.history.replace("/doc#section");
    const doc = stack.render("/doc#section");
    expect(slide().calls).toContain(`retarget ${doc} at 1200`);
  });

  test("a redirect of the screen being slid to continues the same slide", async () => {
    const stack = mount();
    stack.history.push("/me");
    const me = stack.render("/me");
    stack.history.replace("/login");
    const login = stack.render("/login");
    expect(fake.slides).toHaveLength(1);
    expect(slide().calls).toContain(`retarget ${login} at 0`);

    slide().finish();
    await flush();
    expect(shownPaths(stack.core)).toEqual(["/login", "/home"]);
    expect(stack.core.screens().map((screen) => screen.id)).not.toContain(me);
  });
});

describe("R6 cut", () => {
  test("another navigation during a slide ends it on the screen arrived at and starts the next", () => {
    const stack = mount();
    stack.history.push("/post");
    stack.render("/post");
    stack.history.push("/other");
    const other = stack.render("/other");
    expect(slide(0).calls.at(-1)).toBe(`end ${other} now`);
    expect(fake.slides).toHaveLength(2);
    expect(slide()).toMatchObject({ enter: other });
  });
});

describe("edge swipe", () => {
  test("R7: the window follows the finger's nearer screen, with a margin", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const drag = fake.begin!()!;
    for (const progress of [0.7, 0.5, 0.3, 0.5]) drag.seek(progress);
    expect(slide().calls.filter((call) => call.startsWith("aim"))).toEqual([
      "aim enter",
      "aim leave",
    ]);
  });

  test("R8: a release short of going back plays back to rest; history stays", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const key = stack.history.key;
    const control = swipe(false);
    expect(control.calls.slice(-2)).toEqual(["aim leave", "play leave"]);
    frame();
    control.finish();
    await flush();
    expect(stack.history.key).toBe(key);
    expect(events("settle")).toHaveLength(2);
  });

  test("R8, R9: a back plays first, goes back in history a frame later, and settles once the router commits it", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const key = stack.history.key;
    const control = swipe(true);
    expect(control.calls.slice(-1)).toEqual(["play enter"]);
    expect(stack.history.key).toBe(key);

    expect(stack.history.backs).toBe(0);
    frame();
    expect(stack.history.backs).toBe(1);
    stack.history.land();
    expect(stack.history.key).not.toBe(key);
    stack.render("/home");
    expect(control.calls.at(-1)).toBe("reveal");
    expect(events("commit")[1]?.data).toMatchObject({
      direction: "back",
      phase: "play",
    });

    control.finish();
    await flush();
    expect(control.calls.at(-1)).toBe(`end ${stack.home}`);
    expect(stack.rerender).toHaveBeenCalledTimes(1);
  });

  test("R9, R11: a back played to its end before the router commits it rests there, then settles at the commit", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const control = swipe(true);
    frame();
    stack.history.land();
    stack.render("/post", "stale");
    control.finish();
    await flush();
    frame();
    expect(control.ended).toBe(false);
    expect(events("finished").at(-1)?.data).toMatchObject({ waiting: true });

    stack.render("/home");
    expect(control.ended).toBe(true);
    expect(events("blocked")).toEqual([]);
  });

  test("R9: a back to an entry of the same URL, which the router does not render, settles at the re-render it asks for", async () => {
    const stack = mount("/");
    await pushed(stack, "/post");
    // A tab: the entry replaced with the page behind's URL.
    stack.history.replace("/");
    stack.render("/");
    slide().finish();
    await flush();
    stack.rerender.mockClear();

    const control = swipe(true);
    frame();
    stack.history.land();
    frame();
    expect(stack.rerender).toHaveBeenCalledTimes(1);

    stack.render("/");
    control.finish();
    await flush();
    expect(control.calls.at(-1)).toBe(`end ${stack.home}`);
  });

  test("R10: a blocker sending history back to the entry left slides back to rest", async () => {
    const stack = mount();
    await pushed(stack, "/edit");
    const control = swipe(true);
    frame();
    stack.history.land();
    // The traversal's frame: the router has not rendered the back yet.
    stack.render("/edit", "stale");
    frame();
    expect(events("blocked")).toEqual([]);

    stack.history.go(1);
    frame();
    expect(events("blocked")).toHaveLength(1);
    expect(control.calls.at(-1)).toBe("play leave");
    control.finish();
    await flush();
    expect(control.calls.at(-1)).toBe(`end ${slide().leave}`);
    expect(shownPaths(stack.core)).toEqual(["/edit", "/home"]);
  });

  test("R10: a router holding the entry history went to slides back to rest", async () => {
    const stack = mount();
    await pushed(stack, "/edit");
    const control = swipe(true);
    stack.render("/edit", "held");
    frame();
    stack.history.land();
    frame();
    expect(events("blocked")).toHaveLength(1);
    expect(control.calls.at(-1)).toBe("play leave");
  });

  test("R2, R10: a back a guard redirects to the screen left slides back to rest", async () => {
    const stack = mount("/login");
    const about = await pushed(stack, "/about");
    const control = swipe(true);
    frame();
    stack.history.land();
    stack.history.replace("/about");
    expect(stack.render("/about")).toBe(about);
    expect(events("returned")).toHaveLength(1);
    frame();
    expect(events("blocked")).toEqual([]);
    expect(control.calls.at(-1)).toBe("play leave");

    control.finish();
    await flush();
    expect(control.calls.at(-1)).toBe(`end ${about}`);
    // The entry left for /login shows /about now: nothing shows /login.
    expect(shownPaths(stack.core)).toEqual(["/about"]);
  });

  // The `swipe` prop turned off mid-drag: the drag is never released.
  test("a drag whose swipe is disposed ends its slide", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const drag = fake.begin!()!;
    drag.seek(0.5);

    stack.stop();
    stack.core.listen(false);

    expect(slide().ended).toBe(true);
    expect(events("settle")).toHaveLength(2);
    // A render at rest is not stuck behind the dead drag.
    stack.render("/post");
    expect(events("commit")).toHaveLength(1);
  });

  test("a navigation while the finger is down ends the swipe on it", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const drag = fake.begin!()!;
    drag.seek(0.5);
    stack.history.push("/other");
    const other = stack.render("/other");
    expect(slide(-2).calls.at(-1)).toBe(`end ${other} now`);
    const key = stack.history.key;
    drag.release(true, 0.6);
    frame();
    expect(stack.history.backs).toBe(0);
    expect(stack.history.key).toBe(key);
    expect(events("release")).toEqual([]);
  });
});

describe("R11 settle", () => {
  test("drops the screens no entry at or behind the current one shows, re-rendering only then", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    expect(stack.rerender).not.toHaveBeenCalled();

    stack.history.go(-1);
    stack.render("/home");
    slide().finish();
    await flush();
    expect(stack.rerender).toHaveBeenCalledTimes(1);
    expect(stack.core.screens().map((screen) => screen.id)).toEqual([
      stack.home,
    ]);
    expect(stack.core.screens().map((screen) => screen.id)).not.toContain(post);
  });
});

describe("a swipe's back awaiting its commit", () => {
  // An app syncing state to the URL, a router writing its state: not the
  // traversal of the back.
  test("R10: a history event between the release and the back landing does not bounce it", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    const control = swipe(true);
    stack.history.replace("/post");
    frame();
    expect(stack.history.backs).toBe(1);
    frame();
    expect(events("blocked")).toEqual([]);
    expect(control.calls.at(-1)).toBe("play enter");

    stack.history.land();
    stack.render("/home");
    expect(control.calls.at(-1)).toBe("reveal");
  });

  test("R9: a guard sending the back on to a new screen ends the swipe's slide there", async () => {
    const stack = mount("/login");
    await pushed(stack, "/about");
    const control = swipe(true);
    frame();
    stack.history.land();
    stack.history.replace("/dashboard");
    const dashboard = stack.render("/dashboard");
    expect(control.calls).not.toContain("reveal");
    expect(control.calls.at(-1)).toBe(`end ${dashboard} now`);
    expect(slide()).toMatchObject({ enter: dashboard, back: true });
    expect(events("commit").at(-1)?.data?.direction).toBe("back");
  });

  test("R6: a navigation cutting it slides from the screen in view, not the one left", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    swipe(true);
    frame();
    stack.history.push("/other");
    const other = stack.render("/other");
    expect(slide()).toMatchObject({ enter: other, leave: stack.home });
  });

  test("R6: a second back before the router commits the first slides from the screen in view", async () => {
    const stack = mount();
    const a = await pushed(stack, "/a");
    await pushed(stack, "/b");
    swipe(true);
    frame();
    stack.history.land();
    stack.history.go(-1);
    stack.render("/home");
    expect(slide()).toMatchObject({ enter: stack.home, leave: a, back: true });
    slide().finish();
    await flush();
    expect(shownPaths(stack.core)).toEqual(["/home"]);
  });
});

describe("traversals", () => {
  test("a forward after the back settled comes back as a new screen, at its first scroll", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    stack.history.go(-1);
    stack.render("/home");
    slide().finish();
    await flush();
    logged.length = 0;

    stack.history.go(1);
    expect(stack.render("/post")).not.toBe(post);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
    ]);
    slide().finish();
    await flush();
    expect(win.y).toBe(0);
  });

  test("a forward during the back's slide lands on the kept screen at its scroll", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    win.y = 400;
    onScroll();
    stack.history.go(-1);
    stack.render("/home");
    logged.length = 0;

    stack.history.go(1);
    expect(stack.render("/post")).toBe(post);
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "push",
    ]);
    slide().finish();
    await flush();
    expect(win.y).toBe(400);
  });

  test("a double back committed twice is two backs, the second cutting the first", async () => {
    const stack = mount();
    await pushed(stack, "/a");
    await pushed(stack, "/b");
    logged.length = 0;
    stack.history.go(-1);
    stack.render("/a");
    stack.history.go(-1);
    stack.render("/home");
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "back",
      "back",
    ]);
    expect(slide(-2).calls.at(-1)).toBe(`end ${stack.home} now`);
    slide().finish();
    await flush();
    expect(shownPaths(stack.core)).toEqual(["/home"]);
  });

  test("a double back committed once is one back", async () => {
    const stack = mount();
    await pushed(stack, "/a");
    await pushed(stack, "/b");
    logged.length = 0;
    stack.history.go(-1);
    stack.history.go(-1);
    stack.render("/home");
    expect(events("commit").map((entry) => entry.data?.direction)).toEqual([
      "back",
    ]);
    slide().finish();
    await flush();
    expect(shownPaths(stack.core)).toEqual(["/home"]);
  });

  // Chromium keeps 50 entries: past them it drops the oldest and renumbers.
  test("direction compares the indexes entries have now", async () => {
    const stack = mount();
    await pushed(stack, "/a");
    await pushed(stack, "/b");
    await pushed(stack, "/c");
    stack.history.renumber(2);
    logged.length = 0;
    stack.history.push("/d");
    stack.render("/d");
    expect(events("commit").at(-1)?.data?.direction).toBe("push");
  });

  test("direction is a push when the entry the screen left was cut by a push", async () => {
    const stack = mount();
    const post = await pushed(stack, "/post");
    // The router never committed the back; a push cuts /post's entry.
    stack.history.go(-1);
    stack.history.push("/other");
    logged.length = 0;
    stack.render("/other");
    expect(events("commit").at(-1)?.data).toMatchObject({
      from: post,
      direction: "push",
    });
  });
});

describe("render", () => {
  test("R1 reads view() only where a navigation's kind decides", () => {
    const stack = mount("/search?q=a");
    let reads = 0;
    const r = (path: string) => ({
      path,
      view: (): View => (reads++, "current"),
    });
    stack.core.resolve(r("/search?q=a"));
    stack.core.resolve(r("/other"));
    expect(reads).toBe(0);
    stack.core.resolve(r("/search?q=b"));
    expect(reads).toBe(1);
  });

  // A concurrent render React throws away: nothing it changed stays wrong.
  test("a render thrown away heals at the next commit", () => {
    const stack = mount("/search?q=a");
    stack.core.resolve({ path: "/other", view: () => "current" });
    expect(shownPaths(stack.core)).toEqual(["/other", "/search?q=a"]);
    stack.render("/search?q=a");
    expect(shownPaths(stack.core)).toEqual(["/search?q=a"]);

    stack.core.resolve({ path: "/search?q=b", view: () => "current" });
    expect(stack.render("/search?q=a")).toBe(stack.home);
    expect(shownPaths(stack.core)).toEqual(["/search?q=a"]);
  });
});

describe("scrolls", () => {
  test("saved by the scroll listener at rest only, and once as a swipe starts", async () => {
    const stack = mount();
    win.y = 300;
    onScroll();
    stack.history.push("/post");
    stack.render("/post");
    // The slide aims the window: not the screen's own scroll.
    win.y = 900;
    onScroll();
    slide().finish();
    await flush();

    win.y = 250;
    const control = swipe(false);
    win.y = 0;
    control.finish();
    await flush();
    expect(win.y).toBe(250);

    stack.history.go(-1);
    stack.render("/home");
    slide().finish();
    await flush();
    expect(win.y).toBe(300);
  });

  test("kept across a detach and attach (StrictMode), which subscribe once", async () => {
    const stack = mount();
    win.y = 300;
    onScroll();
    await pushed(stack, "/post");
    stack.core.detach();
    stack.core.attach({
      host: (id) => ({ id }) as unknown as HTMLElement,
      rerender: stack.rerender,
    });

    const control = swipe(true);
    frame();
    stack.history.land();
    expect(frames).toHaveLength(1);
    stack.render("/home");
    control.finish();
    await flush();
    expect(win.y).toBe(300);
  });
});

test("R7: the window turns to a screen only past 55% or under 45%", async () => {
  const stack = mount();
  await pushed(stack, "/post");
  const drag = fake.begin!()!;
  for (const progress of [0.7, 0.48, 0.52, 0.3]) drag.seek(progress);
  expect(slide().calls.filter((call) => call.startsWith("aim"))).toEqual([
    "aim enter",
    "aim leave",
  ]);
});

test("R6: a navigation cutting a drag forgets the finger", async () => {
  const stack = mount();
  await pushed(stack, "/post");
  const drag = fake.begin!()!;
  drag.seek(0.5);
  fake.forgets = 0;
  stack.history.push("/other");
  stack.render("/other");
  expect(fake.forgets).toBeGreaterThan(0);
});

// A concurrent render React throws away leaves no trace: what a render
// changes is its pending id, the rest waits for the commit.
test("P5: a render thrown away does not change the shown screen's path", () => {
  const stack = mount("/search?q=a");
  stack.core.resolve({ path: "/search?q=b", view: () => "current" });
  expect(shownPaths(stack.core)).toEqual(["/search?q=a"]);
});

// bfcache, a tab switched, an app sent to the background.
test("R12: the page hidden settles a running slide, and a back not sent yet is not sent", async () => {
  const stack = mount();
  await pushed(stack, "/post");
  const control = swipe(true);
  onPageHide?.();
  expect(control.ended).toBe(true);
  expect(events("settle")).toHaveLength(2);
  frame();
  expect(stack.history.backs).toBe(0);
});

test("a slide settling keeps a finger down that has not decided; a drag ended by the page hidden is dropped", async () => {
  const stack = mount();
  await pushed(stack, "/post");
  // A navigation forgets the finger (R6); a settle alone does not.
  fake.forgets = 0;
  swipe(false);
  slide().finish();
  await flush();
  expect(fake.forgets).toBe(0);

  const drag = fake.begin!()!;
  drag.seek(0.3);
  onPageHide?.();
  expect(fake.forgets).toBe(1);
});

test("the swipe opens on the edge, the whole screen where allowed, and not while dragging", async () => {
  const stack = mount();
  expect(fake.opens.at(-1)).toBeNull();
  await pushed(stack, "/post");
  expect(fake.opens.at(-1)).toBe("edge");

  stack.core.update({
    animate: () => ({}) as never,
    progress: false,
    swipe: (from) => (from === "/post" ? "full" : "edge"),
    sameScreen: defaultSameScreen,
  });
  stack.render("/post");
  expect(fake.opens.at(-1)).toBe("screen");

  const opens = fake.opens.length;
  fake.begin!()!.seek(0.3);
  stack.render("/post");
  expect(fake.opens).toHaveLength(opens);
});

test("R12: the page hidden at rest changes nothing", async () => {
  const stack = mount();
  await pushed(stack, "/post");
  onPageHide?.();
  expect(events("settle")).toHaveLength(1);
});

test("a second stack attached at once warns in development: one per document", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const first = mount();
    expect(warn).not.toHaveBeenCalled();
    const second = mount();
    expect(warn).toHaveBeenCalledTimes(1);
    second.core.detach();
    first.core.detach();
    // StrictMode: detached, then attached again.
    first.core.attach({ host: () => null, rerender() {} });
    expect(warn).toHaveBeenCalledTimes(1);
    first.core.detach();
  } finally {
    warn.mockRestore();
  }
});

// iOS WKWebView tells an app sent to the background by visibilitychange only;
// frames stop while hidden.
describe("R12: the page hidden", () => {
  const hide = () => {
    page.visibilityState = "hidden";
    onVisibility?.();
  };

  test("settles a slide", () => {
    const stack = mount();
    stack.history.push("/post");
    stack.render("/post");
    hide();
    expect(slide().ended).toBe(true);
    expect(events("settle")).toHaveLength(1);
  });

  test("before a swipe's back is sent, sends none", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    swipe(true);
    hide();
    frame();
    expect(stack.history.backs).toBe(0);
  });

  test("during a drag forgets the finger", async () => {
    const stack = mount();
    await pushed(stack, "/post");
    fake.begin!()!.seek(0.5);
    fake.forgets = 0;
    hide();
    expect(slide().ended).toBe(true);
    expect(fake.forgets).toBeGreaterThan(0);
  });

  test("shown again changes nothing", () => {
    const stack = mount();
    stack.history.push("/post");
    stack.render("/post");
    onVisibility?.();
    expect(slide().ended).toBe(false);
    expect(events("settle")).toEqual([]);
  });
});

// Next without its hint renders a query push on the screen shown, which then
// absorbs the entry: that screen shows two URLs.
test("R1: a hidden screen showing an entry is drawn again for it, whatever its path", () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const stack = mount("/");
    // Next without its hint: it renders a navigation, writes history in an
    // insertion effect, then the stack commits.
    const pushNext = (to: string) => {
      const r: Render = { path: to, view: () => "current" };
      const id = stack.core.resolve(r);
      stack.history.push(to);
      stack.core.commit(id, r);
      return id;
    };

    expect(pushNext("/?c=dev")).toBe(stack.home);
    const item = pushNext("/item");
    stack.history.go(-2);
    expect(stack.render("/")).toBe(stack.home);
    expect(stack.core.screens().map((screen) => screen.id)).toEqual([
      item,
      stack.home,
    ]);

    expect(pushNext("/?c=dev")).toBe(stack.home);
    expect(report).not.toHaveBeenCalled();
  } finally {
    report.mockRestore();
  }
});

// A router telling it renders the current entry with another page: the core
// would hold two screens for one entry. Reported in development.
test("two screens for one history screen are reported in development", () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const stack = mount("/a");
    stack.render("/b");
    expect(report).toHaveBeenCalledTimes(1);
  } finally {
    report.mockRestore();
  }
});
