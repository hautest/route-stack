import { connection } from "next/server";
import { slow } from "@/lib/data";
import { Header } from "../ui";

export default async function Slow() {
  await connection();
  const { message } = await slow();
  return (
    <div className="page">
      <Header title="느린 페이지" />
      <div className="content">{message}</div>
    </div>
  );
}
