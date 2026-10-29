import { useLoaderData } from "react-router";
import { slow } from "../api";
import { Header } from "../ui";

export async function loader() {
  return slow();
}

export function Component() {
  const { message } = useLoaderData<typeof loader>();
  return (
    <div className="page">
      <Header title="느린 페이지" />
      <div className="content">{message}</div>
    </div>
  );
}
