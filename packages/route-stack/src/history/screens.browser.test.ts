import { describe, expect, test } from "vitest";
import { entries, type Entries, type NavigationEvent } from "./index";
import { polyfill } from "./polyfill/index";
import { createScreenMap } from "./screens";

const trackScreens = (tracked: Entries) => {
  const screens = createScreenMap(tracked);
  tracked.subscribe(screens.apply);
  return screens;
};

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

// Which screen an entry shows is decided by history alone, the moment the entry
// becomes current, so the stack never depends on when (or whether) a router
// renders.
function scenario(get: () => Entries, base: string) {
  const at = (path: string) => `${base}${path}`;

  test("a push to another query is a new screen, a #fragment or a replace keeps it", async () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);

    // Another item, as /a/1 to /a/2 would be.
    history.pushState(null, "", at("/a?id=1"));
    const one = s.screenOf(tracked.current().key);
    expect(one).not.toBe(a);

    await traverse(() => {
      location.hash = "#section";
    });
    expect(s.screenOf(tracked.current().key)).toBe(one);

    // Typing a search: the router keeps the page mounted.
    history.replaceState(null, "", at("/a?id=1&q=x"));
    expect(s.screenOf(tracked.current().key)).toBe(one);

    // Two pushes in one task: Next renders for neither, the router for only the
    // last.
    history.pushState(null, "", at("/a?id=2"));
    const two = tracked.current().key;
    history.pushState(null, "", at("/a?id=3"));
    expect(s.screenOf(two)).not.toBe(one);
    expect(s.screenOf(tracked.current().key)).not.toBe(s.screenOf(two));
  });

  test("a replace to another pathname is a new screen", () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);
    history.replaceState(null, "", at("/b"));
    expect(s.screenOf(tracked.current().key)).not.toBe(a);
  });

  // What the swipe relies on: the screen it shows behind is the one the back
  // lands on.
  test("the back screen is the screen of the entry a back lands on", async () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/b"));
    const b = s.screenOf(tracked.current().key);
    expect(s.backScreen()).toBe(a);

    history.pushState(null, "", at("/b?q=1"));
    const q = s.screenOf(tracked.current().key);
    expect(s.backScreen()).toBe(b);

    // Not the screen listed below: /c was never rendered, the back still lands
    // on it.
    history.pushState(null, "", at("/c"));
    const c = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/d"));
    expect(s.backScreen()).toBe(c);

    await traverse(() => history.back());
    expect(s.backScreen()).toBe(q);
  });

  test("the back screen is unknown for an entry not seen since this module loaded", () => {
    const tracked = get();
    history.pushState(null, "", at("/unseen"));
    const s = trackScreens(tracked);
    expect(s.backScreen()).toBeNull();
  });

  test("another pathname is a new screen, even one shown before", () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/b"));
    const b = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/a"));
    const again = s.screenOf(tracked.current().key);

    expect(b).not.toBe(a);
    expect(again).not.toBe(a);
    expect(again).not.toBe(b);
  });

  test("going back shows the screen the entry showed before", async () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/a?q=1"));
    const q = s.screenOf(tracked.current().key);
    history.pushState(null, "", at("/b"));

    await traverse(() => history.back());
    expect(s.screenOf(tracked.current().key)).toBe(q);
    await traverse(() => history.back());
    expect(s.screenOf(tracked.current().key)).toBe(a);
  });

  test("a replace to another pathname is a new screen, and the old one is not kept", () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    history.pushState(null, "", at("/login"));
    const login = s.screenOf(tracked.current().key)!;

    history.replaceState(null, "", at("/home"));
    const home = s.screenOf(tracked.current().key)!;
    expect(home).not.toBe(login);
    expect(s.kept(login)).toBe(false);
    expect(s.kept(home)).toBe(true);
  });

  test("a screen is kept while an entry at or behind the current one shows it", async () => {
    const tracked = get();
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key)!;
    history.pushState(null, "", at("/b"));
    const b = s.screenOf(tracked.current().key)!;

    expect(s.kept(a)).toBe(true);

    // Gone back from: still in history, but ahead.
    await traverse(() => history.back());
    expect(s.kept(b)).toBe(false);
    expect(s.kept(a)).toBe(true);

    // Cut by a push.
    history.pushState(null, "", at("/c"));
    expect(s.kept(b)).toBe(false);
  });
}

// WebKit's Navigation API gives a replaced entry a new key (the spec keeps it);
// Next replaces the entry it restores on back. The event's `from` tells which
// entry the new key took the place of.
test("an entry replaced under a new key keeps its screen and the back screen behind it", () => {
  const live = new Map([["a", 0]]);
  const entry = (key: string, index: number, path: string) => ({
    key,
    index,
    url: `${location.origin}/fake${path}`,
  });
  let current = entry("a", 0, "/a");
  const s = createScreenMap({
    current: () => current,
    indexOf: (key) => live.get(key) ?? null,
  });
  const go = (type: NavigationEvent["type"], to: typeof current) => {
    if (type === "replace") live.delete(current.key);
    live.set(to.key, to.index);
    const from = current;
    current = to;
    s.apply({ type, from, to });
  };

  go("push", entry("b", 1, "/b"));
  go("replace", entry("b-replaced", 1, "/b?sort=new"));
  expect(s.screenOf("b-replaced")).toBe(s.screenOf("b"));
  expect(s.backScreen()).toBe(s.screenOf("a"));
  expect(s.direction(s.screenOf("a"), s.screenOf("b-replaced"))).toBe("push");
});

describe.runIf("navigation" in window)("Navigation API", () =>
  scenario(() => entries, "/nav"),
);

describe("polyfill", () => {
  let installed: Entries | undefined;
  scenario(
    () => (installed ??= window.navigation ? polyfill() : entries),
    "/poly",
  );
});
