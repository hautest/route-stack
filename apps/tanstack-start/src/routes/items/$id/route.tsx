import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { getItem } from "../../../api";
import { ItemContext } from "../../../item-context";
import { Header } from "../../../ui";

type ItemSearch = { tab?: "info"; fail?: 1; delay?: number };

// Shared by the detail page and the edit form.
export const Route = createFileRoute("/items/$id")({
  validateSearch: (search: Record<string, unknown>): ItemSearch => ({
    tab: search.tab === "info" ? "info" : undefined,
    fail: String(search.fail) === "1" ? 1 : undefined,
    delay: Number(search.delay) || undefined,
  }),
  loaderDeps: ({ search: { fail, delay } }) => ({ fail, delay }),
  loader: ({ params, deps }) =>
    getItem({
      data: { id: Number(params.id), delay: deps.delay, fail: deps.fail === 1 },
    }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : [],
  }),
  component: ItemLayout,
  errorComponent: ItemError,
  notFoundComponent: ItemNotFound,
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

// Server function errors reach the client without their original message in production.
function ItemError() {
  return (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>글을 불러오지 못했어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}

function ItemNotFound() {
  const { id } = Route.useParams();
  return (
    <div className="page">
      <Header title="글 없음" />
      <div className="error">
        <p>글 {id}을 찾을 수 없어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
