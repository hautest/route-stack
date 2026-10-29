import { expect, test } from "vitest";
import type { Entry } from "./entry";
import { createScreenMap, defaultSameScreen } from "./screens";

// Entries by hand: `live` is what history still holds (key → index).
function entries(first: Entry) {
  const live = new Map([[first.key, first.index]]);
  let current = first;
  let lookups = 0;
  const map = createScreenMap({
    current: () => current,
    indexOf(key) {
      lookups++;
      return live.get(key) ?? null;
    },
  });
  return {
    map,
    live,
    move(to: Entry, type: "push" | "replace" | "traverse") {
      const from = current;
      if (type === "push")
        for (const [key, index] of live)
          if (index >= to.index) live.delete(key);
      live.set(to.key, to.index);
      current = to;
      map.apply({ type, from, to });
    },
    get lookups() {
      return lookups;
    },
  };
}

const at = (key: string, index: number, path: string) => ({
  key,
  index,
  url: `https://app.test${path}`,
});

// Entries made before a reload or this module, or a fragment's popstate under
// the polyfill: never recorded.
test("a traversal to an entry never seen is the screen it came from at the same URL, else a new one", () => {
  const history = entries(at("a", 1, "/a"));
  const a = history.map.screenOf("a");

  history.move(at("before", 0, "/a#top"), "traverse");
  expect(history.map.screenOf("before")).toBe(a);

  history.move(at("older", 0, "/b"), "traverse");
  expect(history.map.screenOf("older")).not.toBe(a);
  expect(history.map.screenOf("older")).not.toBeNull();
});

test("a push forgets the entries it cut: lookups stay with the entries history holds", () => {
  const history = entries(at("k0", 0, "/0"));
  for (let round = 0; round < 20; round++) {
    history.move(at(`a${round}`, 1, `/a${round}`), "push");
    history.move(at(`b${round}`, 2, `/b${round}`), "push");
    history.move(at("k0", 0, "/0"), "traverse");
  }
  const before = history.lookups;
  history.map.kept(0);
  history.map.backScreen();
  expect(history.lookups - before).toBeLessThanOrEqual(2 * 3);
});

test("the default: a push to the same pathname and query, a replace to the same pathname", () => {
  for (const type of ["push", "replace"] as const) {
    expect(defaultSameScreen("/a?x=1", "/a?x=1#c", type)).toBe(true);
    expect(defaultSameScreen("/a#b", "/a#c", type)).toBe(true);
    expect(defaultSameScreen("/a", "/b", type)).toBe(false);
  }
  expect(defaultSameScreen("/a?x=1", "/a?x=2", "push")).toBe(false);
  expect(defaultSameScreen("/a", "/a?x=1", "push")).toBe(false);
  expect(defaultSameScreen("/a?x=1", "/a?x=2#c", "replace")).toBe(true);
  expect(defaultSameScreen("/a#b", "/b#b", "replace")).toBe(false);
});

test("a push or replace is decided by the rule set, with the URLs without origin", () => {
  const history = entries(at("a", 0, "/list?sort=old"));
  const a = history.map.screenOf("a");
  history.move(at("a", 0, "/list?sort=new"), "replace");
  expect(history.map.screenOf("a")).toBe(a);

  const calls: string[][] = [];
  history.map.setSameScreen((from, to, type) => {
    calls.push([from, to, type]);
    return from.split("#")[0] === to.split("#")[0];
  });
  history.move(at("a", 0, "/list?sort=top#x"), "replace");
  const b = history.map.screenOf("a");
  expect(b).not.toBe(a);
  history.move(at("a", 0, "/list?sort=top#y"), "replace");
  expect(history.map.screenOf("a")).toBe(b);
  history.move(at("c", 1, "/list?sort=old"), "push");
  expect(history.map.screenOf("c")).not.toBe(b);
  // An entry not seen is asked about as a push.
  history.move(at("d", 2, "/list?sort=top"), "traverse");
  expect(calls).toEqual([
    ["/list?sort=new", "/list?sort=top#x", "replace"],
    ["/list?sort=top#x", "/list?sort=top#y", "replace"],
    ["/list?sort=top#y", "/list?sort=old", "push"],
    ["/list?sort=old", "/list?sort=top", "push"],
  ]);
});
