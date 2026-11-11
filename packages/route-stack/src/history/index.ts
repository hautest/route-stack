import { NO_ENTRY, type Entries } from "./entry";
import { record } from "./record/index";
import { createScreenMap, type ScreenMap } from "./screens";

export type { Entries, Entry, NavigationEvent } from "./entry";
export type { ScreenMap } from "./screens";

// One instance per document, even if the module is evaluated twice (HMR,
// duplicate bundles): a second record would stamp over the first one's keys.
const INSTANCE = Symbol.for("route-stack.entries");
const instances = globalThis as unknown as Record<symbol, Tracked | undefined>;

export type Tracked = Entries &
  Omit<ScreenMap, "apply"> & {
    /**
     * Whether the browser itself drew the traversal to the screen the current
     * entry shows (Safari's swipe from the screen edge).
     */
    drawn(): boolean;
  };

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
  drawn: () => false,
};

// The screen map subscribes first: every other listener sees the entry's screen.
const create = (): Tracked => {
  const entries = record();
  const { apply, ...screens } = createScreenMap(entries);
  entries.subscribe(apply);

  // By entry and screen, not a flag: a traversal that changed no screen must
  // not still the next slide, nor a replace of the entry by another screen (a
  // guard's redirect, a tab bar). Capture, after the record's own: the entry
  // is current, its screen decided.
  let drawn: { key: string; screen: number | null } | null = null;
  let noted: Event | undefined;
  const note = (event: PopStateEvent) => {
    noted = event;
    const { key } = entries.current();
    drawn = event.hasUAVisualTransition
      ? { key, screen: screens.screenOf(key) }
      : null;
  };
  addEventListener("popstate", note, true);

  return {
    ...entries,
    ...screens,
    drawn() {
      // Asked inside a router's popstate listener added before this module
      // loaded: Chromium runs it before the one above. Only an event later
      // than the one noted: `window.event` goes on naming an event through
      // the promise callbacks its listeners started.
      const event = window.event;
      if (
        event instanceof PopStateEvent &&
        event.timeStamp > (noted?.timeStamp ?? -1)
      )
        note(event);
      const { key } = entries.current();
      return drawn?.key === key && drawn.screen === screens.screenOf(key);
    },
  };
};

export const entries: Tracked =
  typeof window === "undefined" ? onServer : (instances[INSTANCE] ??= create());
