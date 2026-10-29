/** A session history entry. A replace keeps the key, a push makes a new one. */
export interface Entry {
  key: string;
  index: number;
  url: string;
}

/**
 * A change of the current entry, shaped as the Navigation API's: `from` is the
 * entry current before (null when unknown), `to` the one current now. A replace
 * may give `to` a new key (WebKit's Navigation API): `from` is the entry it
 * replaced.
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
   * by a push).
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
 * Stands in for an entry where there is none: on the server, or before the
 * document is active.
 */
export const NO_ENTRY: Entry = { key: "", index: 0, url: "" };
