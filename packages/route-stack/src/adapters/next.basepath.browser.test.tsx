import { useInsertionEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { onRouterTransitionStart, Stack } from "./next";

// Run with `basePath: "/app"` and `trailingSlash: true` (vitest.config.ts):
// `usePathname` has neither the base path nor Next's normalization of the href
// it is given, history has both.
const url = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => url.pathname,
  useSearchParams: () => new URLSearchParams(url.search),
}));

let write: (() => void) | null = null;
function HistoryUpdater() {
  useInsertionEffect(() => {
    write?.();
    write = null;
  });
  return null;
}

function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = () => {
    const path = url.pathname + (url.search && `?${url.search}`);
    flushSync(() =>
      root.render(
        <>
          <HistoryUpdater />
          <Stack animate={() => false as const}>
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

// As Next does it: the hint gets the app's href, history its `addBasePath`.
const navigate = (type: "push" | "replace", href: string, search: string) => {
  onRouterTransitionStart(href, type);
  url.pathname = "/search/";
  url.search = search;
  write = () =>
    history[type === "push" ? "pushState" : "replaceState"](
      null,
      "",
      `/app/search/?${search}`,
    );
  app!.render();
};

const screenIds = () =>
  [...document.querySelectorAll("[data-stack-screen]")].map((host) =>
    host.getAttribute("data-stack-screen"),
  );

let app: ReturnType<typeof mount> | null = null;
let error: ReturnType<typeof vi.spyOn>;
afterEach(() => {
  app?.unmount();
  app = null;
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

const start = () => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  history.replaceState(null, "", "/app/search/?q=a");
  url.pathname = "/search/";
  url.search = "q=a";
  app = mount();
  return screenIds();
};

test("a query replace keeps the screen, asked about history's URLs", () => {
  const before = start();
  navigate("replace", "/search/?q=ab", "q=ab");
  expect(screenIds()).toEqual(before);
});

test("a query push is a new screen, its href without the trailing slash", () => {
  const before = start();
  navigate("push", "/search?q=b", "q=b");
  expect(screenIds()).toHaveLength(2);
  expect(screenIds()).toEqual(expect.arrayContaining(before));
});
