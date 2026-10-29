import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/data";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return Response.json(
    await getFeed({
      category: params.get("category"),
      offset: Number(params.get("offset")) || 0,
      limit: Math.min(Number(params.get("limit")) || 20, 100),
    }),
  );
}
