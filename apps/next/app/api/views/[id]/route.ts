import { logView } from "@/lib/data";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/views/[id]">,
) {
  return Response.json({ count: await logView(Number((await params).id)) });
}
