import type { Metadata } from "next";
import { loadItem } from "../item";
import { EditForm } from "./edit-form";

export async function generateMetadata({
  params,
}: PageProps<"/items/[id]/edit">): Promise<Metadata> {
  return { title: `수정: ${(await loadItem((await params).id)).title}` };
}

export default function EditPage() {
  return <EditForm />;
}
