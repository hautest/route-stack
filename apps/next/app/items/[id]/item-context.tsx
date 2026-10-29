"use client";

import { createContext, use, type ReactNode } from "react";
import type { Item } from "@/lib/data";

const ItemContext = createContext<Item | null>(null);

export function ItemProvider({
  item,
  children,
}: {
  item: Item;
  children: ReactNode;
}) {
  return <ItemContext value={item}>{children}</ItemContext>;
}

export function useItem() {
  const item = use(ItemContext);
  if (!item) throw new Error("useItem must be used inside the item layout");
  return item;
}
