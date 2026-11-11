import { describe, expect, test } from "vitest";
import { entries, type Entry, type NavigationEvent } from "./index";

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

// The contract the entries keep. The stack tells push from back by
// comparing indexes, finds a kept screen again by key, and drops screens whose
// entries are gone. A fragment navigation cannot be told to have added an
// entry, so it keeps the index.
function scenario() {
  describe("identifies entries", () => {
    test("a push makes a new key one index ahead, and keeps the router's state", () => {
      const tracked = entries;
      const start = tracked.current();
      history.pushState({ a: 1 }, "", "?push");
      expect(tracked.current().key).not.toBe(start.key);
      expect(tracked.current().index).toBe(start.index + 1);
      expect(history.state.a).toBe(1);
    });

    test("a replace keeps the key and index, and the router's state", () => {
      const tracked = entries;
      history.pushState(null, "", "?before-replace");
      const { key, index } = tracked.current();
      history.replaceState({ b: 2 }, "", "?replaced");
      expect(tracked.current()).toEqual({ key, index, url: location.href });
      expect(history.state.b).toBe(2);
    });

    test("a traversal lands on the entry it left, back and forward", async () => {
      const tracked = entries;
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
      const tracked = entries;
      history.pushState(null, "", "?page");
      const page = tracked.current();
      await traverse(() => {
        location.hash = "#fragment";
      });
      expect(tracked.current().key).not.toBe(page.key);
      expect(tracked.current().index).toBe(page.index);
      await traverse(() => history.back());
      expect(tracked.current()).toEqual(page);
    });
  });

  // What prune relies on: a cut entry is gone, the ones behind are not.
  test("a push cuts the entries ahead", async () => {
    const tracked = entries;
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

  // What R10 relies on to spot a router blocker undoing a swipe's back: the
  // entry is already current inside popstate listeners, and go(1) lands on the
  // same entry again.
  test("a blocker's go(1) after back lands on the same entry", async () => {
    const tracked = entries;
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
      const tracked = entries;
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
      const tracked = entries;
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
      const tracked = entries;
      let calls = 0;
      const stop = tracked.subscribe(() => calls++);
      history.replaceState(null, "", "?notify-replace");
      stop();
      expect(calls).toBeGreaterThan(0);
    });

    test("no more after unsubscribing", () => {
      const tracked = entries;
      let calls = 0;
      const stop = tracked.subscribe(() => calls++);
      stop();
      history.pushState(null, "", "?unsubscribed");
      expect(calls).toBe(0);
    });
  });
}

describe("entries", scenario);

describe("drawn", () => {
  const popstate = (drawn: boolean) => {
    const event = new PopStateEvent("popstate");
    Object.defineProperty(event, "hasUAVisualTransition", { value: drawn });
    dispatchEvent(event);
  };

  test("a traversal the browser drew is known for its entry only", () => {
    expect(entries.drawn()).toBe(false);
    popstate(true);
    expect(entries.drawn()).toBe(true);
    history.pushState(null, "", "?after-drawn");
    expect(entries.drawn()).toBe(false);
  });

  // What `drawn` reads at a popstate: the entry changes in a listener added
  // earlier.
  test("the entry arrived at is current when a traversal's popstate comes", async () => {
    history.pushState(null, "", "?drawn-from");
    const from = entries.current();
    history.pushState(null, "", "?drawn-to");
    let seen: Entry | null = null;
    const onPop = () => (seen = entries.current());
    addEventListener("popstate", onPop, { capture: true, once: true });
    await traverse(() => history.back());
    expect(seen).toEqual(from);
  });

  // A guard's redirect, a tab bar on replace: the browser drew another screen.
  test("the entry replaced by another screen is not, by the same one is", () => {
    history.pushState(null, "", "/drawn-screen");
    popstate(true);
    history.replaceState(null, "", "/drawn-screen?sorted");
    expect(entries.drawn()).toBe(true);
    history.replaceState(null, "", "/drawn-elsewhere");
    expect(entries.drawn()).toBe(false);
  });

  test("a later traversal of the page's own is not", () => {
    popstate(true);
    popstate(false);
    expect(entries.drawn()).toBe(false);
  });
});
