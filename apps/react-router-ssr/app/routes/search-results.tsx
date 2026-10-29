import { useEffect, useState } from "react";
import { Form, Link, useSearchParams } from "react-router";
import { search, type Item } from "../data.server";
import { Header } from "../ui";
import type { Route } from "./+types/search-results";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const sort = url.searchParams.get("sort") ?? "new";
  return { q, sort, results: await search(q, sort) };
}

export default function SearchResults({ loaderData }: Route.ComponentProps) {
  const { q, sort, results } = loaderData;
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (!params.has("sort")) {
      setParams(
        (prev) => {
          prev.set("sort", "new");
          return prev;
        },
        { replace: true },
      );
    }
  }, [params, setParams]);

  return (
    <div className="page">
      <Header title={`"${q}" 검색 결과`} />
      <div className="content">
        <Form action="/search/results">
          <input
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            key={q}
          />
        </Form>
      </div>
      <nav className="tabs">
        <Link
          to={`?q=${encodeURIComponent(q)}&sort=new`}
          replace
          aria-current={sort === "new"}
        >
          최신순
        </Link>
        <Link
          to={`?q=${encodeURIComponent(q)}&sort=popular`}
          replace
          aria-current={sort === "popular"}
        >
          인기순
        </Link>
      </nav>
      <Results key={q} results={results} />
    </div>
  );
}

function Results({ results }: { results: Item[] }) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  if (results.length === 0)
    return <p className="loading">검색 결과가 없어요.</p>;
  return (
    <ul className="list">
      {results.map((item) => (
        <li key={item.id}>
          <Link to={`/items/${item.id}`}>{item.title}</Link>
          <button
            className="like"
            aria-expanded={expanded.has(item.id)}
            onClick={() => setExpanded((prev) => new Set(prev).add(item.id))}
          >
            미리보기
          </button>
          {expanded.has(item.id) && <p className="muted">{item.body[0]}</p>}
        </li>
      ))}
    </ul>
  );
}
