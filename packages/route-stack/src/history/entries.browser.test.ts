import { describe, expect, test } from "vitest";
import {
  entries,
  type Entries,
  type Entry,
  type NavigationEvent,
} from "./index";
import { polyfill } from "./polyfill/index";

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

// The contract both implementations keep. The stack tells push from back by
// comparing indexes, finds a kept screen again by key, and drops screens whose
// entries are gone. fragmentStep: the polyfill can't tell a fragment navigation
// added an entry, so it keeps the index.
function scenario(get: () => Entries, fragmentStep: number) {
  describe("identifies entries", () => {
    test("a push makes a new key one index ahead, and keeps the router's state", () => {
      const tracked = get();
      const start = tracked.current();
      history.pushState({ a: 1 }, "", "?push");
      expect(tracked.current().key).not.toBe(start.key);
      expect(tracked.current().index).toBe(start.index + 1);
      expect(history.state.a).toBe(1);
    });

    test("a replace keeps the key and index, and the router's state", () => {
      const tracked = get();
      history.pushState(null, "", "?before-replace");
      const { key, index } = tracked.current();
      history.replaceState({ b: 2 }, "", "?replaced");
      expect(tracked.current()).toEqual({ key, index, url: location.href });
      expect(history.state.b).toBe(2);
    });

    test("a traversal lands on the entry it left, back and forward", async () => {
      const tracked = get();
      history.pushState(null, "", "?t1");
      const t1 = tracked.current();
      history.pushState(null, "", "?t2");
      const t2 = tracked.current();
      await traverse(() => history.back());
      expect(tracked.current()).toEqual(t1);
      await traverse(() => history.forward());
      expect(tracked.current()).toEqual(t2);
    });

    test("a fragment navigation is another entry, and back returns to the page", async () => {
      const tracked = get();
      history.pushState(null, "", "?page");
      const page = tracked.current();
      await traverse(() => {
        location.hash = "#fragment";
      });
      expect(tracked.current().key).not.toBe(page.key);
      expect(tracked.current().index).toBe(page.index + fragmentStep);
      await traverse(() => history.back());
      expect(tracked.current()).toEqual(page);
    });
  });

  // What prune relies on: a cut entry is gone, the ones behind are not.
  test("a push cuts the entries ahead", async () => {
    const tracked = get();
    history.pushState(null, "", "?kept");
    const kept = tracked.current();
    history.pushState(null, "", "?cut");
    const cut = tracked.current();
    await traverse(() => history.back());
    history.pushState(null, "", "?new");
    expect(tracked.indexOf(cut.key)).toBeNull();
    expect(tracked.indexOf(kept.key)).toBe(kept.index);
    expect(tracked.indexOf(tracked.current().key)).toBe(
      tracked.current().index,
    );
  });

  // What the swipe relies on to spot a router blocker undoing its back: the
  // entry is already current inside popstate listeners, and go(1) lands on the
  // same entry again.
  test("a blocker's go(1) after back lands on the same entry", async () => {
    const tracked = get();
    history.pushState(null, "", "?blocker-a");
    const a = tracked.current();
    history.pushState(null, "", "?blocker-b");
    const b = tracked.current();
    let inListener: Entry | undefined;
    addEventListener("popstate", () => (inListener = tracked.current()), {
      once: true,
    });
    await traverse(() => history.back());
    expect(inListener).toEqual(a);
    await traverse(() => history.go(1));
    expect(tracked.current()).toEqual(b);
  });

  // What the screen tracking relies on: it runs before a router renders, even
  // when none does.
  describe("notifies", () => {
    test("the kind, the entry left and the entry arrived at", async () => {
      const tracked = get();
      const seen: NavigationEvent[] = [];
      const stop = tracked.subscribe((event) => seen.push(event));
      history.pushState(null, "", "?kind-a");
      const a = tracked.current();
      history.pushState(null, "", "?kind-b");
      const b = tracked.current();
      history.replaceState(null, "", "?kind-c");
      const c = tracked.current();
      await traverse(() => history.back());
      stop();
      expect(seen.slice(-3)).toMatchObject([
        { type: "push", from: { key: a.key }, to: b },
        { type: "replace", from: { key: b.key, url: b.url }, to: c },
        { type: "traverse", from: { key: c.key }, to: a },
      ]);
    });

    test("on push and traversal, with the entry already current", async () => {
      const tracked = get();
      const seen: string[] = [];
      const stop = tracked.subscribe(() => seen.push(tracked.current().key));
      history.pushState(null, "", "?notify");
      expect(seen.at(-1)).toBe(tracked.current().key);
      const before = seen.length;
      await traverse(() => history.back());
      expect(seen.length).toBeGreaterThan(before);
      expect(seen.at(-1)).toBe(tracked.current().key);
      stop();
    });

    test("on replace", () => {
      const tracked = get();
      let calls = 0;
      const stop = tracked.subscribe(() => calls++);
      history.replaceState(null, "", "?notify-replace");
      stop();
      expect(calls).toBeGreaterThan(0);
    });

    test("no more after unsubscribing", () => {
      const tracked = get();
      let calls = 0;
      const stop = tracked.subscribe(() => calls++);
      stop();
      history.pushState(null, "", "?unsubscribed");
      expect(calls).toBe(0);
    });
  });
}

describe.runIf("navigation" in window)("Navigation API", () =>
  scenario(() => entries, 1),
);

// backScreen() and kept() look up every entry of the session in one pass.
test.runIf("navigation" in window)(
  "the Navigation API's entries are read once per change of history",
  () => {
    const read = navigation.entries;
    let reads = 0;
    navigation.entries = function () {
      reads++;
      return read.call(this);
    };
    try {
      history.pushState(null, "", "?snapshot-a");
      const a = entries.current();
      for (let i = 0; i < 5; i++) expect(entries.indexOf(a.key)).toBe(a.index);
      expect(reads).toBe(1);

      history.pushState(null, "", "?snapshot-b");
      const b = entries.current();
      expect(entries.indexOf(b.key)).toBe(b.index);
      expect(entries.indexOf(a.key)).toBe(a.index);
      expect(reads).toBe(2);
    } finally {
      navigation.entries = read;
    }
  },
);

// Installed after the Navigation API run: it patches this document's history
// methods.
describe("polyfill", () => {
  let installed: Entries | undefined;
  // Where the engine has no Navigation API, entries already is the polyfill; a
  // second one would stamp over it.
  scenario(() => (installed ??= window.navigation ? polyfill() : entries), 0);
});
