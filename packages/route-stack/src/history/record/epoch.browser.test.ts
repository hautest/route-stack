import { beforeAll, expect, test, vi } from "vitest";
import type { Tracked } from "../index";

// A reload on an entry a #fragment added: it carries no stamp, so the record
// starts a run of indexes of its own there, at 0, beside entries stamped by the run
// before the reload.
let entries: Tracked;
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

const traverse = async (go: () => void) => {
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  go();
  await landed;
};

const stamped = (key: string, index: number) => ({
  __routeStack: { key, index, epoch: "before-reload" },
});

beforeAll(async () => {
  const native = History.prototype.pushState;
  native.call(history, stamped("list", 1), "", "/count/list");
  native.call(history, stamped("post", 2), "", "/count/post");
  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  location.hash = "#comments";
  await landed;
  ({ entries } = await import("../index"));
});

// Compared, the entry loaded on (0) read as behind the list (1): a swipe from
// the list showed the post, which is ahead of it, and the list was dropped.
test("entries of another run are forgotten, not compared", async () => {
  const loaded = entries.current();
  expect(loaded.index).toBe(0);

  await traverse(() => history.back());
  expect(entries.current().key).toBe("post");
  expect(entries.indexOf(loaded.key)).toBeNull();

  await traverse(() => history.back());
  expect(entries.current()).toMatchObject({ key: "list", index: 1 });
  expect(entries.backScreen()).toBeNull();
  expect(
    entries.direction(entries.screenOf("post"), entries.screenOf("list")),
  ).toBe("back");
});

test("a push goes on in the run of the entry it leaves", () => {
  history.pushState(null, "", "/count/next");
  expect(entries.current().index).toBe(2);
  expect(history.state.__routeStack.epoch).toBe("before-reload");
  expect(entries.backScreen()).toBe(entries.screenOf("list"));
});

// Once: what the page loses (its swipe back) is not seen where it happens.
test("dev warns the first time a #fragment adds an entry", async () => {
  warn.mockClear();
  await traverse(() => {
    location.hash = "#one";
  });
  await traverse(() => history.back());
  await traverse(() => {
    location.hash = "#two";
  });
  const calls = warn.mock.calls.filter(([message]) =>
    String(message).includes("#fragment"),
  );
  expect(calls).toHaveLength(1);
});
