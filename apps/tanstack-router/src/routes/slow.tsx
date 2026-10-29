import { createFileRoute } from "@tanstack/react-router";
import { slow } from "../api";
import { Header } from "../ui";

export const Route = createFileRoute("/slow")({
  loader: () => slow(),
  component: Slow,
});

function Slow() {
  const { message } = Route.useLoaderData();
  return (
    <div className="page">
      <Header title="느린 페이지" />
      <div className="content">{message}</div>
    </div>
  );
}
