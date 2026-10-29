"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { updateItem } from "@/lib/data";

export async function saveItem(id: number, form: FormData) {
  await updateItem(id, String(form.get("title")), String(form.get("body")));
  // The detail page shares the [id] layout, which would otherwise keep the old title.
  revalidatePath(`/items/${id}`, "layout");
  // Server Actions push by default; saving should replace the edit entry.
  redirect(`/items/${id}`, RedirectType.replace);
}
