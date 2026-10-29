import { getNewPostCount } from "../data.server";
import type { Route } from "./+types/api.new-posts";

export async function loader({ request }: Route.LoaderArgs) {
  const since =
    Number(new URL(request.url).searchParams.get("since")) || Date.now();
  return { since, count: await getNewPostCount(since) };
}
