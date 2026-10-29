import {
  data,
  isRouteErrorResponse,
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
  type LoaderFunctionArgs,
} from "react-router";
import { getItem, NotFoundError } from "../api";
import { Header } from "../ui";
import { ItemContext } from "./item-context";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  try {
    return await getItem(Number(params.id), {
      delay: Number(url.searchParams.get("delay") ?? 300),
      fail: url.searchParams.get("fail") === "1",
    });
  } catch (error) {
    if (error instanceof NotFoundError)
      throw data(error.message, { status: 404 });
    throw error;
  }
}

// Shared by the detail page and the edit form.
export function Component() {
  const item = useLoaderData<typeof loader>();
  return (
    <div className="page" key={item.id}>
      <Header title={item.title} />
      <ItemContext value={item}>
        <Outlet />
      </ItemContext>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="page">
      <Header title={notFound ? "글 없음" : "오류"} />
      <div className="error">
        <p>
          {isRouteErrorResponse(error)
            ? String(error.data)
            : error instanceof Error
              ? error.message
              : "오류가 났어요."}
        </p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
