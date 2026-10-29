import { NO_ENTRY, type Entries, type Entry } from "./entry";

const entryOf = (entry: NavigationHistoryEntry): Entry => ({
  key: entry.key,
  index: entry.index,
  url: entry.url ?? "",
});

export function fromNavigation(navigation: Navigation): Entries {
  // A pass over the session's entries looks each up: entries() copies them all
  // at every call. They change with the current entry, and when Chromium drops
  // the oldest past 50 and renumbers the rest, with no event: the current
  // entry's index tells.
  let indexes: Map<string, number> | null = null;
  navigation.addEventListener("currententrychange", () => (indexes = null));

  const current = () => {
    const entry = navigation.currentEntry;
    return entry ? entryOf(entry) : NO_ENTRY;
  };

  return {
    current,
    indexOf(key) {
      const now = navigation.currentEntry;
      if (!indexes || (now && indexes.get(now.key) !== now.index))
        indexes = new Map(
          navigation.entries().map((entry) => [entry.key, entry.index]),
        );
      return indexes.get(key) ?? null;
    },
    back: () => history.back(),
    subscribe(listener) {
      const onChange = (event: NavigationCurrentEntryChangeEvent) =>
        listener({
          type:
            event.navigationType === "push" ||
            event.navigationType === "traverse"
              ? event.navigationType
              : "replace",
          from: entryOf(event.from),
          to: current(),
        });
      navigation.addEventListener("currententrychange", onChange);
      return () =>
        navigation.removeEventListener("currententrychange", onChange);
    },
  };
}
