import { describe, expect, test } from "vitest";
import { entries, type Entries } from "./index";
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
function scenario() {
  const at = (path: string) => `/own${path}`;

  test("a push to another query is a new screen, a #fragment or a replace keeps it", async () => {
    const tracked = entries;
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
    const tracked = entries;
    history.pushState(null, "", at("/a"));
    const s = trackScreens(tracked);
    const a = s.screenOf(tracked.current().key);
    history.replaceState(null, "", at("/b"));
    expect(s.screenOf(tracked.current().key)).not.toBe(a);
  });

  // What the swipe relies on: the screen it shows behind is the one the back
  // lands on.
  test("the back screen is the screen of the entry a back lands on", async () => {
    const tracked = entries;
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

  // The entry a #fragment added carries no stamp and shares its page's
  // index: which of the two a back lands on is not known, so no screen is
  // offered to a swipe (rather than a wrong one).
  test("the back screen of a page whose #fragment was visited is unknown", async () => {
    const tracked = entries;
    history.pushState(null, "", at("/list"));
    const s = trackScreens(tracked);
    history.pushState(null, "", at("/post"));
    await traverse(() => {
      location.hash = "#comments";
    });
    await traverse(() => history.back());
    expect(location.hash).toBe("");
    expect(s.backScreen()).toBeNull();
  });

  test("the back screen is unknown for an entry not seen since this module loaded", () => {
    const tracked = entries;
    history.pushState(null, "", at("/unseen"));
    const s = trackScreens(tracked);
    expect(s.backScreen()).toBeNull();
  });

  test("another pathname is a new screen, even one shown before", () => {
    const tracked = entries;
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
    const tracked = entries;
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
    const tracked = entries;
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
    const tracked = entries;
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

describe("entries", scenario);
