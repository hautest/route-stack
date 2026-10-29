"use client";

import { useLocation } from "react-router";
import { Stack as Core } from "../stack/Stack";
import type { StackProps } from "../types";

export function Stack(props: Omit<StackProps, "path">) {
  const { pathname, search, key } = useLocation();
  return (
    <Core
      {...props}
      path={pathname + search}
      view={() => (key === entryKey() ? "current" : "stale")}
    />
  );
}

// The key React Router gives the entry history is at ("default" for one it
// never wrote): the rendered location's once its loaders are done.
const entryKey = () =>
  (history.state as { key?: string } | null)?.key ?? "default";
