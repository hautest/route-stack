"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { entries } from "../history/index";
import { pathnameOf } from "../history/screens";
import { dev } from "../log";
import { Stack as Core } from "../stack/Stack";
import type { NavigationType, StackProps, View } from "../types";

// Next renders a navigation before it writes history, so the stack cannot ask
// `sameScreen` about it by history. Next's `onRouterTransitionStart` tells the
// kind and URL first: kept here for the renders of that URL until history
// changes (Next writes the entry after rendering it). Not at the stack's next
// commit: one for another update (an ancestor's state set in the same click)
// can come before the navigation's.
const NAVIGATION = Symbol.for("route-stack.navigation");

interface NavigationHint {
  /** Path with query, as the stack's `path`. */
  url: string;
  /** The URL as history will have it. */
  href: string;
  type: NavigationType;
}

const hints = globalThis as { [NAVIGATION]?: NavigationHint | null };

const pathOf = (pathname: string, search: string) => {
  const query = new URLSearchParams(search).toString();
  return query ? `${pathname}?${query}` : pathname;
};

export function Stack(props: Omit<StackProps, "path">) {
  // The URL only in the browser: on the server, reading it in a root wrapper
  // blocks the prerender (cacheComponents: dynamic routes, search params)
  // unless the app adds a Suspense boundary, and the server renders a single
  // screen whatever the path. Same order on every render of one environment:
  // the condition never changes in a browser.
  // oxlint-disable-next-line react/rules-of-hooks
  const path = typeof window === "undefined" ? "" : useBrowserPath();

  return <Core {...props} path={path} view={() => viewOf(path)} />;
}

const viewOf = (path: string): View => {
  const hint = hints[NAVIGATION];
  // By pathname: a proxy may change the query of the URL hinted. A traverse
  // is history's, which has it before Next renders.
  if (
    hint &&
    hint.type !== "traverse" &&
    pathnameOf(hint.url) === pathnameOf(path)
  )
    return { ahead: hint.type, url: hint.href };
  return rendersCurrent(path) ? "current" : "stale";
};

let warned = false;

if (typeof window !== "undefined")
  entries.subscribe(({ type, from, to }) => {
    // No hint ever (the instrumentation file missing) and a query push Next
    // wrote (`__NA`): the push stays on the screen shown.
    if (
      dev &&
      !warned &&
      hints[NAVIGATION] === undefined &&
      type === "push" &&
      from &&
      new URL(from.url).pathname === new URL(to.url).pathname &&
      from.url.split("#")[0] !== to.url.split("#")[0] &&
      (history.state as { __NA?: boolean } | null)?.__NA === true
    ) {
      warned = true;
      console.warn(
        'route-stack/next: export { onRouterTransitionStart } from "route-stack/next" in instrumentation-client.ts; without it a query-only push stays on the same screen.',
      );
    }
    // Null, not deleted: a hint came once.
    if (hints[NAVIGATION]) hints[NAVIGATION] = null;
  });

// A push or replace is in history by the commit of its render (Next writes it
// in an insertion effect), but a back or forward moves history first and
// renders later (in a transition that can wait for segments): another update
// in between commits the page left. Compared as Next derives `usePathname`.
const rendersCurrent = (path: string) =>
  path === pathOf(removeBasePath(location.pathname), location.search);

// Next inlines its basePath and trailingSlash config in the client bundle,
// node_modules too.
declare const process: {
  env: { __NEXT_ROUTER_BASEPATH?: string; __NEXT_TRAILING_SLASH?: boolean };
};
const basePath = process.env.__NEXT_ROUTER_BASEPATH || "";
const trailingSlash = process.env.__NEXT_TRAILING_SLASH;

const removeBasePath = (pathname: string) =>
  basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || "/"
    : pathname;

function useBrowserPath() {
  return pathOf(usePathname(), useSearchParams().toString());
}

/**
 * Next's `instrumentation-client.ts` hook: the kind of each navigation, known
 * before Next renders it. Re-export it from that file.
 */
export function onRouterTransitionStart(url: string, type: NavigationType) {
  // Next passes the app's href; history gets it through Next's `addBasePath`.
  const target = new URL(
    url.startsWith("/") ? basePath + url : url,
    location.href,
  );
  if (url.startsWith("/")) target.pathname = withTrailingSlash(target.pathname);
  hints[NAVIGATION] = {
    url: pathOf(removeBasePath(target.pathname), target.search),
    href: target.href,
    type,
  };
}

// Next's `normalizePathTrailingSlash`: a file path never ends with a slash.
const withTrailingSlash = (pathname: string) =>
  trailingSlash && !/\.[^/]+\/?$/.test(pathname)
    ? pathname.endsWith("/")
      ? pathname
      : `${pathname}/`
    : pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
