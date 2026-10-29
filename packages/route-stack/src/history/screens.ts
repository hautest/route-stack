import type { Direction, SameScreen } from "../types";
import type { Entries, Entry, NavigationEvent } from "./entry";

export interface ScreenMap {
  apply(event: NavigationEvent): void;
  /**
   * The screen an entry shows; null for an entry not current since this module
   * loaded.
   */
  screenOf(key: string): number | null;
  /**
   * The screen of the entry a back lands on; null when unknown or ambiguous.
   */
  backScreen(): number | null;
  /** Whether an entry at or behind the current one shows the screen. */
  kept(screen: number): boolean;
  /**
   * The current entry shows `screen` after all: a router rendered another
   * screen's content for it (a guard sending a back on to the screen left, a
   * navigation it skipped past).
   */
  assign(key: string, screen: number): void;
  /**
   * From the entries each screen was last current at, looked up now (indexes
   * are renumbered by the browser past 50 entries). Unknown is a push.
   */
  direction(from: number | null, to: number | null): Direction;
  /** The rule a push or replace is decided by from now on. */
  setSameScreen(rule: SameScreen): void;
}

export const pathnameOf = (url: string) => url.split(/[?#]/)[0];

/**
 * A push stays on the screen to the same pathname and query (a #fragment); a
 * replace while the pathname stays (typing a search, a sort), as the router
 * keeps the page mounted.
 */
export const defaultSameScreen: SameScreen = (from, to, type) =>
  type === "replace"
    ? pathnameOf(from) === pathnameOf(to)
    : from.split("#")[0] === to.split("#")[0];

/** An entry's URL as `sameScreen` gets it: pathname, query and #fragment. */
export const pathOfUrl = (url: string) => {
  const { pathname, search, hash } = new URL(url, "http://_");
  return pathname + search + hash;
};

// The screen of an entry is decided when it becomes current, from history
// alone: a router may never render for it, or render it late. A traversal to an
// entry not seen is decided as a push.
export function createScreenMap(
  entries: Pick<Entries, "current" | "indexOf">,
): ScreenMap {
  let sameScreen = defaultSameScreen;
  let next = 0;
  const screens = new Map<string, number>();
  const last = new Map<number, Entry>();

  const record = (entry: Entry, screen: number) => {
    screens.set(entry.key, screen);
    last.set(screen, entry);
  };

  const first = entries.current();
  record(first, next++);

  const indexOf = (screen: number | null) => {
    const entry = screen === null ? undefined : last.get(screen);
    return entry ? entries.indexOf(entry.key) : null;
  };

  return {
    apply({ type, from, to }) {
      const before = from && screens.get(from.key);
      let screen = type === "traverse" ? screens.get(to.key) : undefined;

      if (screen === undefined) {
        const same =
          from &&
          sameScreen(
            pathOfUrl(from.url),
            pathOfUrl(to.url),
            type === "replace" ? "replace" : "push",
          );
        screen = same && before != null ? before : next++;
      }

      // The replaced entry's place is the new one's, whichever screen it shows.
      if (type === "replace" && from && before != null)
        if (last.get(before)?.key === from.key) last.set(before, to);

      record(to, screen);

      // backScreen() and kept() go through the entries known: not the ones a
      // push cut, which never come back.
      if (type === "push")
        for (const key of screens.keys())
          if (entries.indexOf(key) === null) screens.delete(key);
    },
    screenOf: (key) => screens.get(key) ?? null,
    backScreen() {
      const { key, index } = entries.current();

      let screen: number | null = null;
      for (const [other, shown] of screens) {
        const at = entries.indexOf(other);
        // The polyfill gives a #fragment entry the index of the page it came
        // from: which of them a back lands on is unknown.
        if (at === index && other !== key) return null;
        if (at !== index - 1) continue;
        if (screen !== null && screen !== shown) return null;
        screen = shown;
      }

      return screen;
    },
    kept(screen) {
      const current = entries.current().index;

      for (const [key, shown] of screens) {
        if (shown !== screen) continue;
        const index = entries.indexOf(key);
        if (index !== null && index <= current) return true;
      }

      return false;
    },
    assign(key, screen) {
      const entry = entries.current();
      screens.set(key, screen);
      if (entry.key === key) last.set(screen, entry);
    },
    direction(from, to) {
      const before = indexOf(from);
      const after = indexOf(to);
      if (before === null || after === null || after > before) return "push";
      return after < before ? "back" : "replace";
    },
    setSameScreen(rule) {
      sameScreen = rule;
    },
  };
}
