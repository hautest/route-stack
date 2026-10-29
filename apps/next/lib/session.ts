export const SESSION_COOKIE = "next_session";

// Only same-origin paths are accepted as a post-login destination.
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
