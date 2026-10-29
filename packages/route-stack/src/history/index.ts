import { NO_ENTRY, type Entries } from "./entry";
import { fromNavigation } from "./navigation";
import { polyfill } from "./polyfill/index";
import { createScreenMap, type ScreenMap } from "./screens";

export type { Entries, Entry, NavigationEvent } from "./entry";
export type { ScreenMap } from "./screens";

// One instance per document, even if the module is evaluated twice (HMR,
// duplicate bundles): a second polyfill would stamp over the first one's keys.
const INSTANCE = Symbol.for("route-stack.entries");
const instances = globalThis as unknown as Record<symbol, Tracked | undefined>;

export type Tracked = Entries & Omit<ScreenMap, "apply">;

const onServer: Tracked = {
  current: () => NO_ENTRY,
  indexOf: (key) => (key === NO_ENTRY.key ? NO_ENTRY.index : null),
  back: () => {},
  subscribe: () => () => {},
  screenOf: (key) => (key === NO_ENTRY.key ? 0 : null),
  backScreen: () => null,
  kept: (screen) => screen === 0,
  assign: () => {},
  direction: () => "push",
  setSameScreen: () => {},
};

// The screen map subscribes first: every other listener sees the entry's screen.
const create = (): Tracked => {
  const entries = window.navigation
    ? fromNavigation(window.navigation)
    : polyfill();
  const { apply, ...screens } = createScreenMap(entries);
  entries.subscribe(apply);
  return { ...entries, ...screens };
};

export const entries: Tracked =
  typeof window === "undefined" ? onServer : (instances[INSTANCE] ??= create());
