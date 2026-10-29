import { createContext, use } from "react";
import type { ItemDetail } from "../api";

export const ItemContext = createContext<ItemDetail | null>(null);

export function useItem() {
  const item = use(ItemContext);
  if (!item) throw new Error("useItem must be used inside the item layout");
  return item;
}
