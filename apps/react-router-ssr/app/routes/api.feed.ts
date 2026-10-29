import { getFeed } from "../data.server";
import type { Route } from "./+types/api.feed";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return Response.json(
    await getFeed({
      category: url.searchParams.get("category"),
      offset: Number(url.searchParams.get("offset")) || 0,
      limit: 20,
    }),
  );
}
