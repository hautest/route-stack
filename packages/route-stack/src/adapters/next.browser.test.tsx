import { useInsertionEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { defaultSameScreen } from "../history/screens";
import type { SameScreen } from "../types";
import { onRouterTransitionStart, Stack } from "./next";

// Next's URL hooks, as the router renders them: the new URL in the render of a
// navigation, before history has it.
const url = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => url.pathname,
  useSearchParams: () => new URLSearchParams(url.search),
}));

// Next writes the entry of a navigation after rendering it (an insertion
// effect of its router).
let write: (() => void) | null = null;
function HistoryUpdater() {
  useInsertionEffect(() => {
    write?.();
    write = null;
  });
  return null;
}

function mount(sameScreen: SameScreen = defaultSameScreen) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = url.pathname + (url.search && `?${url.search}`);
    flushSync(() =>
      root.render(
        <>
          <HistoryUpdater />
          <Stack animate={() => false as const} sameScreen={sameScreen}>
            <div data-page={path}>{path}</div>
          </Stack>
        </>,
      ),
    );
  };
  render();
  return {
    render,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

const go = (pathname: string, search: string) => {
  url.pathname = pathname;
  url.search = search;
};

let app: ReturnType<typeof mount> | null = null;
afterEach(() => {
  app?.unmount();
  app = null;
});

test("a query push is a new screen though an ancestor's update commits the stack first", () => {
  history.replaceState(null, "", "/list?page=1");
  go("/list", "page=1");
  app = mount();

  // One click: an ancestor's state set, then router.push().
  onRouterTransitionStart("/list?page=2", "push");
  app.render();

  go("/list", "page=2");
  write = () => history.pushState(null, "", "/list?page=2");
  app.render();

  expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(2);
  expect(document.querySelector("[data-page]")?.textContent).toBe(
    "/list?page=2",
  );
});

test("the hint ends with the entry it was for: a later query replace keeps the screen", () => {
  history.replaceState(null, "", "/list?page=1");
  go("/list", "page=1");
  app = mount();

  onRouterTransitionStart("/list?page=2", "push");
  go("/list", "page=2");
  write = () => history.pushState(null, "", "/list?page=2");
  app.render();
  expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(2);

  // A replace whose hint never came (the router writes history only).
  go("/list", "page=2&sort=new");
  write = () => history.replaceState(null, "", "/list?page=2&sort=new");
  app.render();
  expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(2);

  // Back to the pushed URL by another such replace: a hint kept past its
  // entry would call it a push (a new screen).
  go("/list", "page=2");
  write = () => history.replaceState(null, "", "/list?page=2");
  app.render();
  expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(2);
});

const screenIds = () =>
  [...document.querySelectorAll("[data-stack-screen]")].map((host) =>
    host.getAttribute("data-stack-screen"),
  );

const replaceSort = () => {
  onRouterTransitionStart("/list?sort=new", "replace");
  go("/list", "sort=new");
  write = () => history.replaceState(null, "", "/list?sort=new");
  app!.render();
};

test("a query replace keeps the screen", () => {
  history.replaceState(null, "", "/list?sort=old");
  go("/list", "sort=old");
  app = mount();
  const before = screenIds();

  replaceSort();
  expect(screenIds()).toEqual(before);
  expect(document.querySelector("[data-page]")?.textContent).toBe(
    "/list?sort=new",
  );
});

test("sameScreen can make a query replace a new screen", () => {
  history.replaceState(null, "", "/list?sort=old");
  go("/list", "sort=old");
  app = mount((from, to) => from.split("#")[0] === to.split("#")[0]);
  const before = screenIds();

  replaceSort();
  expect(screenIds()).not.toEqual(before);
  expect(document.querySelector("[data-page]")?.textContent).toBe(
    "/list?sort=new",
  );
});

// A back moves history first; Next renders the page it lands on later (a
// transition that can wait for segments). An update in between commits the
// page left: not the entry history is at.
test("a render of the page left while Next has not rendered a back is not that entry", async () => {
  history.replaceState(null, "", "/home");
  go("/home", "");
  app = mount();

  onRouterTransitionStart("/post", "push");
  go("/post", "");
  write = () => history.pushState(null, "", "/post");
  app.render();

  const landed = new Promise((resolve) =>
    addEventListener("popstate", resolve, { once: true }),
  );
  history.back();
  await landed;
  app.render();

  go("/home", "");
  app.render();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(
    [...document.querySelectorAll("[data-page]")].map(
      (page) => page.textContent,
    ),
  ).toEqual(["/home"]);
});

// A proxy that changes only the query: the pushed URL is not the hinted one,
// its pathname is.
test("a push the proxy redirects to another query is still a new screen", () => {
  history.replaceState(null, "", "/search");
  go("/search", "");
  app = mount();

  onRouterTransitionStart("/search?q=1", "push");
  go("/search", "q=1&p=1");
  write = () => history.pushState(null, "", "/search?q=1&p=1");
  app.render();
  expect(document.querySelectorAll("[data-stack-screen]")).toHaveLength(2);
});

// Without `instrumentation-client.ts`, Next tells no navigation's kind: a
// query push stays on the screen shown. Next marks the entries it writes.
describe("without the hint file", () => {
  const NAVIGATION = Symbol.for("route-stack.navigation");
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[NAVIGATION];
    history.replaceState({ __NA: true }, "", "/list");
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  test("no warning on a replace, a push to another pathname or an app's own push", () => {
    history.replaceState({ __NA: true }, "", "/list?page=2");
    history.pushState({ __NA: true }, "", "/other");
    history.pushState(null, "", "/other?page=2");
    expect(warn).not.toHaveBeenCalled();
  });

  test("no warning once a hint came", () => {
    onRouterTransitionStart("/list?page=2", "push");
    history.pushState({ __NA: true }, "", "/list?page=2");
    expect(warn).not.toHaveBeenCalled();
  });

  test("a warning on Next's query push, once", () => {
    history.pushState({ __NA: true }, "", "/list?page=2");
    history.pushState({ __NA: true }, "", "/list?page=3");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("instrumentation-client");
  });
});
