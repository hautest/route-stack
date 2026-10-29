import type { Entries, Entry, NavigationEvent } from "../entry";

// Safari before 26.2 has no Navigation API. Each entry gets the same key and
// index the API would give, kept in history.state, so a traversal can tell
// which entry it landed on. Indexes count from this document's first entry, and
// after a reload only the entries traversed since are known; the stack only
// compares indexes of entries it saw.

const STATE = "__routeStack";

const isObject = (state: unknown): state is Record<string, unknown> =>
  typeof state === "object" && state !== null;

type Stamp = Pick<Entry, "key" | "index">;

const readStamp = (state: unknown) =>
  isObject(state) ? (state[STATE] as Stamp | undefined) : undefined;

// Not the URL: a fragment navigation keeps the state, not the URL.
const stamp = (state: unknown, { key, index }: Stamp) => ({
  ...(isObject(state) ? state : {}),
  [STATE]: { key, index },
});

const at = (entry: Stamp): Entry => ({ ...entry, url: location.href });

export function polyfill(): Entries {
  let seq = 0;
  const newKey = () => `${Date.now().toString(36)}-${++seq}`;

  // The current methods, not History.prototype's: wrappers installed earlier
  // (analytics, routers) keep seeing every call.
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  // Stamped already after a reload.
  const loaded = readStamp(history.state);
  let current = at(loaded ?? { key: newKey(), index: 0 });
  if (!loaded) replaceState.call(history, stamp(history.state, current), "");

  /** Entries still in the session history: key → index. */
  const known = new Map([[current.key, current.index]]);
  /**
   * Entries that can't carry a stamp, known by URL instead: fragment
   * navigations (#anchor) and entries made before this module loaded. Their
   * state is left alone, since routers read it (Next.js reloads on a state
   * without its own fields, React Router reads idx).
   */
  const unstamped = new Map<string, Stamp>();

  const listeners = new Set<(event: NavigationEvent) => void>();
  // As the DOM dispatches events: a snapshot of the listeners, and a throwing
  // one doesn't fail the history call (already done) or stop the others.
  const notify = (type: NavigationEvent["type"], from: Entry) => {
    const event = { type, from, to: current };
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        reportError(error);
      }
    }
  };

  const enter = (type: NavigationEvent["type"], entry: Stamp) => {
    const from = current;
    current = at(entry);
    known.set(entry.key, entry.index);
    notify(type, from);
  };

  // A push cuts the entries after the current one. Unstamped entries share the
  // index of the entry they came from, so other unstamped ones at the current
  // index go too: a stale one must never be found again by its URL (a forgotten
  // one only gets a new key if traversed back to; same pathname, same screen).
  // A stamped one at the current index is behind the current entry (the page a
  // fragment came from) and stays. ponytail: entries made before this module
  // loaded share one index, so the order among them is unknown: a push may
  // forget one still behind, or keep a stamped one already cut. Only the
  // Navigation API orders entries exactly; the module loads with the app,
  // before any navigation.
  history.pushState = (data, unused, url) => {
    const entry = { key: newKey(), index: current.index + 1 };
    pushState.call(history, stamp(data, entry), unused, url);

    for (const [href, stale] of unstamped) {
      if (stale.index >= current.index && stale.key !== current.key) {
        unstamped.delete(href);
        known.delete(stale.key);
      }
    }

    for (const [key, index] of known) {
      if (index > current.index) known.delete(key);
    }

    enter("push", entry);
  };

  history.replaceState = (data, unused, url) => {
    // Stamped from now on; its old URL must not match a later fragment entry.
    if (unstamped.get(location.href)?.key === current.key)
      unstamped.delete(location.href);

    const from = current;
    replaceState.call(history, stamp(data, current), unused, url);
    current = at(current);
    notify("replace", from);
  };

  // An unstamped entry can't tell whether it was added or traversed to; it
  // takes the current index, so a direction is never inverted. Capture, added
  // at import: WebKit runs capture listeners at the target before the others,
  // so the entry is current when a router's own popstate listener runs.
  // (Chromium runs them in registration order, but has the Navigation API.)
  addEventListener(
    "popstate",
    () => {
      // history.state, not event.state: WebKit gives a fragment
      // location.replace() a null event.state while the entry keeps its state,
      // so the same entry would get two keys.
      const stamped = readStamp(history.state);
      if (stamped) return enter("traverse", stamped);

      const entry = unstamped.get(location.href) ?? {
        key: newKey(),
        index: current.index,
      };

      unstamped.set(location.href, entry);
      enter("traverse", entry);
    },
    true,
  );

  return {
    current: () => current,
    indexOf: (key) => known.get(key) ?? null,
    back: () => history.back(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
