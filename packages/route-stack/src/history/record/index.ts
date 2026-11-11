import { dev } from "../../log";
import type { Entries, Entry, NavigationEvent } from "../entry";

// The session history's entries, kept by the stack itself in every browser:
// each entry gets a key and an index in history.state, so a traversal can tell
// which entry it landed on. Not the Navigation API, though it orders entries
// exactly: Safari before 26.2 has none, and in a private window WebKit's does
// not follow pushState and replaceState. One record, the same everywhere.
// Indexes count from this document's first entry, and after a reload only the
// entries traversed since are known; the stack only compares indexes of
// entries it saw.

const STATE = "__routeStack";

const isObject = (state: unknown): state is Record<string, unknown> =>
  typeof state === "object" && state !== null;

type Stamp = Pick<Entry, "key" | "index">;
/**
 * As written into history.state. `epoch`: the run of indexes this one is of.
 * A run starts at each load that finds no stamp (the first, and a reload on an
 * entry that carries none): its indexes say nothing about entries stamped by
 * another.
 */
type Written = Stamp & { epoch?: string };

const readStamp = (state: unknown) => {
  const stamp = isObject(state) ? state[STATE] : undefined;
  return isObject(stamp) && typeof stamp.key === "string"
    ? (stamp as unknown as Written)
    : undefined;
};

/**
 * A state the stamp can go into: none, or a plain object. Anything else (a
 * string, an array, a Map) would not survive the spread: it is kept as the app
 * gave it, and its entry known by URL instead.
 */
const stampable = (state: unknown) =>
  state == null ||
  (isObject(state) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(state)));

// In the state, not the URL: a fragment replace changes the URL, keeps the state.
const stamp = (state: unknown, { key, index }: Stamp, epoch?: string) =>
  stampable(state)
    ? { ...(isObject(state) ? state : {}), [STATE]: { key, index, epoch } }
    : state;

const at = ({ key, index }: Stamp): Entry => ({
  key,
  index,
  url: location.href,
});

const sameButFragment = (from: string, to: string) =>
  from !== to && from.split("#")[0] === to.split("#")[0];

export function record(): Entries {
  let seq = 0;
  const newKey = () => `${Date.now().toString(36)}-${++seq}`;

  // The current methods, not History.prototype's: wrappers installed earlier
  // (analytics, routers) keep seeing every call.
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  // Stamped already after a reload.
  const loaded = readStamp(history.state);
  let epoch = loaded ? loaded.epoch : newKey();
  let current = at(loaded ?? { key: newKey(), index: 0 });
  if (!loaded)
    replaceState.call(history, stamp(history.state, current, epoch), "");

  /** Entries still in the session history: key → index. */
  const known = new Map([[current.key, current.index]]);
  /**
   * Entries that can't carry a stamp, known by URL instead: fragment
   * navigations (#anchor), entries made before this module loaded, and ones
   * whose state is not a plain object. Their state is left alone, since
   * routers read it (Next.js reloads on a state without its own fields, React
   * Router reads idx).
   */
  const unstamped = new Map<string, Stamp>();
  if (!loaded && !stampable(history.state))
    unstamped.set(location.href, current);

  // The entry a history call of the record's own is writing, while it is
  // under way: a wrapper under the record may dispatch a popstate for it, or
  // replace the state again before it returns.
  let writing: Stamp | null = null;
  let warned = false;

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

  // A push cuts the entries after the current one. Fragment entries share the
  // index of the entry they came from, so other unstamped ones at the current
  // index go too: a stale one must never be found again by its URL (a forgotten
  // one only gets a new key if traversed back to; same pathname, same screen).
  // A stamped one at the current index is behind the current entry (the page a
  // fragment came from) and stays. ponytail: entries made before this module
  // loaded share one index, so the order among them is unknown: a push may
  // forget one still behind, or keep a stamped one already cut. And entries
  // known by URL can't be told apart at one URL: two pushes of a non-plain
  // state to the same URL leave the second's stamp for both, until a push. Only
  // the Navigation API orders entries exactly; the module loads with the app,
  // before any navigation.
  history.pushState = (data, unused, url) => {
    const entry = { key: newKey(), index: current.index + 1 };
    writing = entry;
    try {
      pushState.call(history, stamp(data, entry, epoch), unused, url);
    } finally {
      writing = null;
    }

    for (const [href, stale] of unstamped) {
      if (stale.index >= current.index && stale.key !== current.key) {
        unstamped.delete(href);
        known.delete(stale.key);
      }
    }

    for (const [key, index] of known) {
      if (index > current.index) known.delete(key);
    }

    if (!stampable(data)) unstamped.set(location.href, entry);
    enter("push", entry);
  };

  history.replaceState = (data, unused, url) => {
    // Inside a call of the record's own (a wrapper under it writing the state
    // once more): after its write the same entry, already told of by that
    // call; before a push's write still the entry being left.
    if (writing) {
      const left = readStamp(history.state)?.key === current.key;
      return replaceState.call(
        history,
        stamp(data, left ? current : writing, epoch),
        unused,
        url,
      );
    }

    const from = current;
    const before = location.href;
    writing = current;
    try {
      replaceState.call(history, stamp(data, current, epoch), unused, url);
    } finally {
      writing = null;
    }
    // Stamped from now on; its old URL must not match a later fragment entry.
    // After the call: one that throws leaves the entry as it was.
    if (unstamped.get(before)?.key === current.key) unstamped.delete(before);
    if (!stampable(data)) unstamped.set(location.href, current);
    current = at(current);
    notify("replace", from);
  };

  // An unstamped entry can't tell whether it was added or traversed to; it
  // takes the current index, so a direction is never inverted. Read where the
  // entry is asked for, not only at the popstate: a router's own popstate
  // listener, added before this module loaded, runs first in Chromium (WebKit
  // runs capture listeners at the target first), and may render there.
  const sync = (asked = false) => {
    // A wrapper under this one dispatching a popstate of its own for the call
    // (single-spa): not a traversal, the call itself tells of the entry.
    if (writing) return;
    // history.state, not event.state: WebKit gives a fragment
    // location.replace() a null event.state while the entry keeps its state,
    // so the same entry would get two keys.
    const stamped = readStamp(history.state);
    // Asked for between a traversal and its popstate: only if it moved.
    if (
      asked &&
      (stamped ? stamped.key === current.key : location.href === current.url)
    )
      return;
    if (stamped) {
      // Stamped in another run of indexes: where this run's entries sit
      // beside it is unknown. They are forgotten rather than compared (no
      // swipe back to them, their screens not kept), and the entry's run is
      // the one that goes on.
      if (stamped.epoch !== epoch) {
        epoch = stamped.epoch;
        known.clear();
        unstamped.clear();
      }
      return enter("traverse", stamped);
    }

    const seen = unstamped.get(location.href);
    if (
      dev &&
      !seen &&
      !warned &&
      sameButFragment(current.url, location.href)
    ) {
      warned = true;
      console.warn(
        "route-stack: a #fragment navigation added or rewrote a history entry, which the stack does not support: it cannot tell such entries apart, and what a back or a swipe shows after it is not guaranteed. Scroll with element.scrollIntoView() to keep the jump out of history.",
      );
    }
    const entry = seen ?? { key: newKey(), index: current.index };

    unstamped.set(location.href, entry);
    enter("traverse", entry);
  };
  addEventListener("popstate", () => sync(), true);

  return {
    current() {
      sync(true);
      return current;
    },
    indexOf(key) {
      sync(true);
      return known.get(key) ?? null;
    },
    back: () => history.back(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
