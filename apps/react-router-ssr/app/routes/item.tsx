import { data, isRouteErrorResponse, Link, Outlet } from "react-router";
import { getItem, NotFoundError } from "../data.server";
import { Header } from "../ui";
import type { Route } from "./+types/item";
import { ItemContext } from "./item-context";

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  try {
    return await getItem(Number(params.id), {
      delay: Number(url.searchParams.get("delay") ?? 300),
      fail: url.searchParams.get("fail") === "1",
    });
  } catch (error) {
    // Thrown as data responses so the message survives production error sanitizing.
    if (error instanceof NotFoundError)
      throw data(error.message, { status: 404 });
    throw data(error instanceof Error ? error.message : "오류가 났어요.", {
      status: 500,
    });
  }
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData?.title },
];

// Shared by the detail page and the edit form.
export default function ItemLayout({ loaderData: item }: Route.ComponentProps) {
  return (
    <div className="page" key={item.id}>
      <Header title={item.title} />
      <ItemContext value={item}>
        <Outlet />
      </ItemContext>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="page">
      <Header title={notFound ? "글 없음" : "오류"} />
      <div className="error">
        <p>
          {isRouteErrorResponse(error) ? String(error.data) : "오류가 났어요."}
        </p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
