import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import { getItem, NotFoundError } from "../../../api";
import { ItemContext } from "../../../item-context";
import { errorMessage, Header } from "../../../ui";

type ItemSearch = { fail?: number; delay?: number };

// Shared by the detail page and the edit form.
export const Route = createFileRoute("/items/$id")({
  validateSearch: (search: Record<string, unknown>): ItemSearch => ({
    fail: search.fail == null ? undefined : Number(search.fail),
    delay: search.delay == null ? undefined : Number(search.delay),
  }),
  loaderDeps: ({ search: { fail, delay } }) => ({ fail, delay }),
  loader: async ({ params, deps }) => {
    try {
      return await getItem(Number(params.id), {
        delay: deps.delay ?? 300,
        fail: deps.fail === 1,
      });
    } catch (error) {
      if (error instanceof NotFoundError) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : [],
  }),
  component: ItemLayout,
  errorComponent: ({ error }) => (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>{errorMessage(error)}</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="page">
      <Header title="글 없음" />
      <div className="error">
        <p>글을 찾을 수 없어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  ),
});

function ItemLayout() {
  const item = Route.useLoaderData();
  return (
    <div className="page" key={item.id}>
      <Header title={item.title} />
      <ItemContext value={item}>
        <Outlet />
      </ItemContext>
    </div>
  );
}
