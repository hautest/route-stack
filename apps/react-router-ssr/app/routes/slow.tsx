import { slow } from "../data.server";
import { Header } from "../ui";
import type { Route } from "./+types/slow";

export async function loader() {
  return slow();
}

export default function Slow({ loaderData }: Route.ComponentProps) {
  return (
    <div className="page">
      <Header title="느린 페이지" />
      <div className="content">{loaderData.message}</div>
    </div>
  );
}
