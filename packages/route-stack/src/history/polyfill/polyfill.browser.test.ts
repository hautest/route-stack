import { beforeAll, describe, expect, test } from "vitest";
import type { Entries, Entry } from "../index";

// A browser without the Navigation API (Safari before 26.2): the module
// installs the polyfill at import, after a router-like wrapper, a router-like
// popstate listener and entries that were made before it loaded.
let entries: Entries;
let wrapperCalls = 0;
let seenByRouter: Entry | undefined;
const native = History.prototype.pushState;

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

beforeAll(async () => {
  Object.defineProperty(window, "navigation", {
    value: undefined,
    configurable: true,
  });
  native.call(history, null, "", "?before=1");
  native.call(history, { router: "kept" }, "", "?before=2");
  const earlier = history.pushState;
  history.pushState = function (...args) {
    wrapperCalls++;
    earlier.apply(this, args);
  };
  addEventListener("popstate", () => (seenByRouter = entries.current()));
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

  // Only WebKit runs a capture listener before ones registered earlier;
  // Chromium, which has the Navigation API, would not use the polyfill.
  test.runIf(!navigator.userAgent.includes("Chrome"))(
    "the entry is current inside a router's earlier popstate listener",
    async () => {
      history.pushState(null, "", "?a");
      const a = entries.current();
      history.pushState(null, "", "?b");
      await traverse(() => history.back());
      expect(seenByRouter).toEqual(a);
    },
  );

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
    expect(history.state.__routeStack).toEqual({
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

  // The swipe spots a router blocker by the key coming back to where it
  // started.
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
