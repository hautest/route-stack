"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { SESSION_COOKIE, safeNext } from "@/lib/session";

export async function login(next: string | null) {
  // Not httpOnly: the /settings client guard reads it.
  (await cookies()).set(SESSION_COOKIE, "1", { path: "/", maxAge: 86400 });
  redirect(safeNext(next), RedirectType.replace);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/", RedirectType.replace);
}
