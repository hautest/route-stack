import { beforeAll, describe, expect, test } from "vitest";
import type { Entry, Tracked } from "../index";

// The module starts its record of history at import, here after a router-like
// wrapper, a router-like popstate listener and entries that were made before
// it loaded.
let entries: Tracked;
let wrapperCalls = 0;
let seenByRouter: Entry | undefined;
let drawnForRouter: boolean | undefined;
// As single-spa: its wrapper tells its own listeners of a history call with a
// popstate.
let echo = false;
// As a scroll saver: it writes into the entry being left, before the push.
let saves = false;
const native = History.prototype.pushState;

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

beforeAll(async () => {
  native.call(history, null, "", "?before=1");
  native.call(history, { router: "kept" }, "", "?before=2");
  const earlier = history.pushState;
  history.pushState = function (...args) {
    wrapperCalls++;
    if (saves) history.replaceState({ ...history.state, saved: 1 }, "");
    earlier.apply(this, args);
    // And, as some do, a history call of its own inside the one it wraps.
    if (echo) history.replaceState(history.state, "");
    if (echo) dispatchEvent(new PopStateEvent("popstate", { state: args[0] }));
  };
  addEventListener("popstate", () => {
    seenByRouter = entries.current();
    drawnForRouter = entries.drawn();
  });
  ({ entries } = await import("../index"));
});

describe("installed into a page already in use, next to routers", () => {
  test("keeps a wrapper installed before it", () => {
    const calls = wrapperCalls;
    history.pushState(null, "", "?wrapped");
    expect(wrapperCalls).toBe(calls + 1);
    expect(entries.current().key).toBe(history.state.__routeStack.key);
  });

  test("never inverts the direction on entries made before it loaded", async () => {
    await traverse(() => history.back());
    const installed = entries.current();
    expect(history.state.router).toBe("kept");

    await traverse(() => history.back());
    const before = entries.current();
    expect(before.index).toBe(installed.index);
    expect(before.key).not.toBe(installed.key);
    expect(history.state).toBeNull();

    await traverse(() => history.forward());
    expect(entries.current()).toEqual(installed);

    await traverse(() => history.back());
    expect(entries.current()).toEqual(before);
    await traverse(() => history.forward());
  });

  // Chromium runs a listener registered earlier before a capture one: the
  // entry is read where it is asked for, not only at the stack's own popstate.
  test("the entry is current inside a router's earlier popstate listener", async () => {
    history.pushState(null, "", "?a");
    const a = entries.current();
    history.pushState(null, "", "?b");
    await traverse(() => history.back());
    expect(seenByRouter).toEqual(a);
  });

  // As the entry: the stack's own popstate listener has not run yet there.
  test("a traversal the browser drew is known inside that listener too", async () => {
    const flag = Object.getOwnPropertyDescriptor(
      PopStateEvent.prototype,
      "hasUAVisualTransition",
    );
    Object.defineProperty(PopStateEvent.prototype, "hasUAVisualTransition", {
      configurable: true,
      get: () => true,
    });
    try {
      history.pushState(null, "", "?drawn-a");
      history.pushState(null, "", "?drawn-b");
      await traverse(() => history.back());
      expect(drawnForRouter).toBe(true);
    } finally {
      if (flag)
        Object.defineProperty(
          PopStateEvent.prototype,
          "hasUAVisualTransition",
          flag,
        );
      else
        delete (PopStateEvent.prototype as { hasUAVisualTransition?: boolean })
          .hasUAVisualTransition;
    }
    await traverse(() => history.back());
    expect(drawnForRouter).toBe(false);
  });

  // Taken for a traversal, the push was told of twice, and the entries it cut
  // stayed known: no swipe back after it.
  test("a popstate a wrapper dispatches for a push is not a traversal", async () => {
    history.pushState(null, "", "?echo-a");
    history.pushState(null, "", "?echo-b");
    const cut = entries.current();
    await traverse(() => history.back());
    const from = entries.current();
    const kinds: string[] = [];
    const stop = entries.subscribe(({ type }) => kinds.push(type));
    echo = true;
    try {
      history.pushState(null, "", "?echo-c");
    } finally {
      echo = false;
      stop();
    }
    expect(kinds).toEqual(["push"]);
    expect(entries.current().index).toBe(from.index + 1);
    expect(entries.indexOf(cut.key)).toBeNull();
    expect(history.state.__routeStack.key).toBe(entries.current().key);
  });

  // Stamped as the new entry, the one left answered to its key: a back to it
  // changed no screen.
  test("a write a wrapper makes before a push stays on the entry being left", async () => {
    history.pushState(null, "", "?save-a");
    const left = entries.current();
    saves = true;
    try {
      history.pushState(null, "", "?save-b");
    } finally {
      saves = false;
    }
    const pushed = entries.current();
    expect(pushed.index).toBe(left.index + 1);
    expect(history.state.__routeStack.key).toBe(pushed.key);
    await traverse(() => history.back());
    expect(history.state.saved).toBe(1);
    expect(history.state.__routeStack.key).toBe(left.key);
    expect(entries.current().key).toBe(left.key);
  });

  // Stamped by a version without runs of indexes: one run among themselves.
  test("entries stamped without a run are compared with each other", async () => {
    const raw = History.prototype.pushState;
    const start = entries.current();
    raw.call(
      history,
      { __routeStack: { key: "old-a", index: 40 } },
      "",
      "?old-a",
    );
    raw.call(
      history,
      { __routeStack: { key: "old-b", index: 41 } },
      "",
      "?old-b",
    );
    await traverse(() => history.back());
    expect(entries.current()).toMatchObject({ key: "old-a", index: 40 });
    await traverse(() => history.forward());
    expect(entries.current()).toMatchObject({ key: "old-b", index: 41 });
    expect(entries.indexOf("old-a")).toBe(40);
    // Back in the run this document began: the others are not compared.
    await traverse(() => history.go(-2));
    expect(entries.current().key).toBe(start.key);
    expect(entries.indexOf("old-a")).toBeNull();
  });

  test("one instance per document", async () => {
    const url = "../index.ts?again";
    const again: typeof import("../index") = await import(
      /* @vite-ignore */ url
    );
    expect(again.entries).toBe(entries);
  });

  // Next.js wraps pushState after mount, so after this module.
  test("stamps calls made through a wrapper installed after it", () => {
    const ours = history.pushState;
    history.pushState = function (...args) {
      ours.apply(this, args);
    };
    history.pushState(null, "", "?later");
    const later = entries.current();
    expect(history.state.__routeStack).toMatchObject({
      key: later.key,
      index: later.index,
    });
    expect(entries.indexOf(later.key)).toBe(later.index);
    history.pushState = ours;
  });
});

describe("traversal reads the entry from history.state", () => {
  test("go(-2) lands on the entry two back", async () => {
    history.pushState(null, "", "?c");
    const c = entries.current();
    history.pushState(null, "", "?d");
    history.pushState(null, "", "?e");
    await traverse(() => history.go(-2));
    expect(entries.current()).toEqual(c);
  });
});

describe("fragment entries: no stamp, known by URL", () => {
  test("a fragment entry keeps the state and is the same entry traversed back to", async () => {
    history.pushState(null, "", "?f");
    const f = entries.current();
    await traverse(() => {
      location.hash = "#comments";
    });
    const fragment = entries.current();
    expect(fragment.index).toBe(f.index);
    expect(fragment.key).not.toBe(f.key);
    expect(history.state).toBeNull();

    history.pushState(null, "", "?next");
    const next = entries.current();
    expect(next.index).toBe(fragment.index + 1);
    expect(entries.indexOf(fragment.key)).toBe(fragment.index);

    await traverse(() => history.back());
    expect(entries.current()).toEqual(fragment);
    await traverse(() => history.back());
    expect(entries.current()).toEqual(f);
  });

  test("a fragment replace keeps the index", async () => {
    history.pushState(null, "", "?g");
    const g = entries.current();
    await traverse(() => location.replace("#tab"));
    expect(entries.current().index).toBe(g.index);
    // Whether the key survives depends on the engine keeping the state (WebKit
    // does, Chromium doesn't); the stack shows the same screen either way, as
    // the pathname is the same.
  });

  test("a fragment entry cut by a push is not found again by its URL", async () => {
    history.pushState(null, "", "?page");
    await traverse(() => {
      location.hash = "#x";
    });
    const cut = entries.current();
    await traverse(() => history.back());
    history.pushState(null, "", "?other");
    const other = entries.current();
    history.pushState(null, "", "?page");
    const page = entries.current();
    await traverse(() => {
      location.hash = "#x";
    });
    expect(entries.current().key).not.toBe(cut.key);
    expect(entries.current().index).toBe(page.index);
    expect(entries.indexOf(other.key)).toBe(other.index);
  });

  test("a fragment entry replaced to another URL is not matched by a later fragment", async () => {
    history.pushState(null, "", "?r");
    await traverse(() => {
      location.hash = "#x";
    });
    const replaced = entries.current();
    history.replaceState({}, "", "?redirected");
    history.pushState(null, "", "?r");
    await traverse(() => {
      location.hash = "#x";
    });
    expect(entries.current().key).not.toBe(replaced.key);
  });

  // R10 spots a router blocker by the entry coming back to where it started:
  // one key for one entry.
  test("a fragment replace keeps one key for the entry", async () => {
    history.pushState({ s: 1 }, "", "?tab");
    await traverse(() => location.replace("#tab"));
    const start = entries.current();
    await traverse(() => history.back());
    await traverse(() => history.go(1));
    expect(entries.current().key).toBe(start.key);
  });

  // A push from a fragment entry cuts only what is ahead: the page the fragment
  // came from stays.
  test("a push from a fragment entry keeps the page behind it", async () => {
    history.pushState(null, "", "?page-a");
    const a = entries.current();
    await traverse(() => {
      location.hash = "#x";
    });
    history.pushState(null, "", "?page-b");
    await traverse(() => history.back());
    history.replaceState(null, "", "?page-c");
    expect(entries.indexOf(a.key)).toBe(a.index);
  });
});

// The stamp goes into a plain object only: anything else (a string, an array,
// a Map) is the app's to keep as it gave it, and its entry is known by URL.
describe("an app's own state", () => {
  test("a state that is not a plain object is kept as is, its entry known", async () => {
    const start = entries.current();
    history.pushState("text", "", "?state=text");
    expect(history.state).toBe("text");
    const text = entries.current();
    expect(text.index).toBe(start.index + 1);

    history.pushState([1, 2], "", "?state=array");
    expect(history.state).toEqual([1, 2]);
    const array = entries.current();
    expect(array.index).toBe(text.index + 1);

    history.pushState(new Map([["a", 1]]), "", "?state=map");
    expect(history.state).toBeInstanceOf(Map);

    await traverse(() => history.back());
    expect(entries.current()).toEqual(array);
    await traverse(() => history.back());
    expect(entries.current()).toEqual(text);
    await traverse(() => history.forward());
    expect(entries.current()).toEqual(array);
  });

  test("a replace with one keeps the entry", () => {
    const before = entries.current();
    history.replaceState(new Date(0), "", "?state=date");
    expect(history.state).toBeInstanceOf(Date);
    expect(entries.current().key).toBe(before.key);
    expect(entries.current().index).toBe(before.index);
  });
});

describe("listeners", () => {
  test("a throwing listener fails neither the push nor the other listeners", () => {
    const reported: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    addEventListener("error", onError);
    let after = 0;
    const stopThrowing = entries.subscribe(() => {
      throw new Error("listener");
    });
    const stopAfter = entries.subscribe(() => after++);
    expect(() => history.pushState(null, "", "?throwing")).not.toThrow();
    stopThrowing();
    stopAfter();
    removeEventListener("error", onError);
    expect(after).toBe(1);
    expect(reported).toHaveLength(1);
  });

  test("a listener that subscribes again is not called again by the same notification", () => {
    let calls = 0;
    let stop = () => {};
    const listener = () => {
      calls++;
      stop();
      stop = entries.subscribe(listener);
    };
    stop = entries.subscribe(listener);
    history.pushState(null, "", "?resubscribe");
    stop();
    expect(calls).toBe(1);
  });
});
