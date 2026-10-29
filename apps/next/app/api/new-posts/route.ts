import type { NextRequest } from "next/server";
import { getNewPostCount } from "@/lib/data";

export async function GET(request: NextRequest) {
  const since = Number(request.nextUrl.searchParams.get("since")) || Date.now();
  return Response.json({ count: await getNewPostCount(since) });
}
