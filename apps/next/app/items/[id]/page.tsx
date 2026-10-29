import type { Metadata } from "next";
import { getComments } from "@/lib/data";
import { ItemDetail } from "./item-detail";
import { loadItem } from "./item";

export async function generateMetadata({
  params,
}: PageProps<"/items/[id]">): Promise<Metadata> {
  return { title: (await loadItem((await params).id)).title };
}

export default async function ItemPage({
  params,
  searchParams,
}: PageProps<"/items/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { comments, related } = await getComments(Number(id), {
    fail: query.fail === "1",
  });
  return (
    <ItemDetail
      tab={query.tab === "info" ? "info" : "body"}
      comments={comments}
      related={related}
    />
  );
}
