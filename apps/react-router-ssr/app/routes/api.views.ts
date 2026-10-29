import { logView } from "../data.server";
import type { Route } from "./+types/api.views";

export async function action({ params }: Route.ActionArgs) {
  return Response.json({ views: await logView(Number(params.id)) });
}
