import { notFound } from "next/navigation";
import { cache } from "react";
import { getItem, NotFoundError } from "@/lib/data";

// Layout, page and metadata all ask for the same item within one request.
export const loadItem = cache(async (id: string) => {
  try {
    return await getItem(Number(id));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
});
