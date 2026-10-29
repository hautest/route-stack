"use client";

import {
  type AnyRouter,
  type ParsedLocation,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Stack as Core } from "../stack/Stack";
import type { StackProps } from "../types";

export function Stack(props: Omit<StackProps, "path">) {
  const router = useRouter();
  // The location of the matches the outlet renders. Not `location`, set when a
  // navigation starts while the outlet still renders the old matches; not
  // `resolvedLocation`, set after the new matches have rendered. Either way a
  // screen would get the other page's content.
  const path = useRouterState({
    select: (state) => pathOf(router, state.matches, state.location),
  });
  // A redirect to the path already shown (a guard sending a back on to the
  // screen left) changes the entry only: a render for it to commit.
  useRouterState({ select: (state) => state.location.state.__TSR_key });
  return (
    <Core
      {...props}
      path={path}
      view={() => {
        if (holds(router.history)) return "held";
        // The location navigated to; its matches render once loaded (until
        // then the old ones, at another path). Matched again rather than its
        // URL compared: a match's path differs from the URL (search defaults
        // from validateSearch, an index route's slash, encoded params).
        const to = router.state.location;
        return to.state.__TSR_key === entryKey() &&
          matchedPath(router, to) === path
          ? "current"
          : "stale";
      }}
    />
  );
}

const pathOf = (
  router: AnyRouter,
  matches: { pathname: string; search: unknown }[],
  location: ParsedLocation,
) => {
  const match = matches.at(-1);
  if (!match) return location.pathname + location.searchStr;
  return (
    match.pathname +
    router.options.stringifySearch(match.search as Record<string, unknown>)
  );
};

// Matched once per location navigated to, not at every commit: the router
// replaces the location object when it moves.
const matched = new WeakMap<ParsedLocation, string>();

const matchedPath = (router: AnyRouter, location: ParsedLocation) => {
  let path = matched.get(location);
  if (path === undefined) {
    path = pathOf(router, router.matchRoutes(location), location);
    matched.set(location, path);
  }
  return path;
};

const entryKey = () =>
  (history.state as { __TSR_key?: string } | null)?.__TSR_key;

// TanStack keeps its own location on the entry it was at while a blocker asks,
// though history has already moved (it restores history only if the user
// stays).
const holds = (routerHistory: {
  location: { state: { __TSR_key?: string } };
}) => routerHistory.location.state.__TSR_key !== entryKey();
