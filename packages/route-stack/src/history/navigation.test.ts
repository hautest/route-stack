import { expect, test } from "vitest";
import { fromNavigation } from "./navigation";

// Chromium past 50 entries drops the oldest and renumbers the rest without a
// currententrychange: a back target then looked ambiguous, and no swipe started.
test("indexes follow a renumbering that came with no event", () => {
  let list = ["a", "b", "c"].map((key, index) => ({ key, index, url: key }));
  const navigation = {
    entries: () => list,
    get currentEntry() {
      return list.at(-1);
    },
    addEventListener() {},
  } as unknown as Navigation;
  const entries = fromNavigation(navigation);

  expect(entries.indexOf("b")).toBe(1);
  list = list.slice(1).map((entry, index) => ({ ...entry, index }));
  expect(entries.indexOf("b")).toBe(0);
  expect(entries.indexOf("a")).toBeNull();
});
