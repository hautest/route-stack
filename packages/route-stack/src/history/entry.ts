/** A session history entry. A push makes a new key; a replace keeps it. */
export interface Entry {
  key: string;
  index: number;
  url: string;
}

/**
 * A change of the current entry: `from` is the entry current before (null
 * when unknown), `to` the one current now.
 */
export interface NavigationEvent {
  type: "push" | "replace" | "traverse";
  from: Entry | null;
  to: Entry;
}

export interface Entries {
  current(): Entry;
  /**
   * The index of a live entry, looked up now; null once the entry is gone (cut
   * by a push), or no longer comparable (stamped in another run of indexes).
   */
  indexOf(key: string): number | null;
  back(): void;
  /**
   * Calls the listener after every push, replace and traversal, synchronously
   * and possibly inside a router's commit, the entry already current. Returns
   * the unsubscribe function.
   */
  subscribe(listener: (event: NavigationEvent) => void): () => void;
}

/**
 * Stands in for an entry where there is none: on the server.
 */
export const NO_ENTRY: Entry = { key: "", index: 0, url: "" };
