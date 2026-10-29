import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { search, type Item } from "../../api";
import { Header } from "../../ui";

type ResultsSearch = { q: string; sort?: "new" | "popular" };

export const Route = createFileRoute("/search/results")({
  validateSearch: (s: Record<string, unknown>): ResultsSearch => ({
    q: s.q == null ? "" : String(s.q),
    sort:
      s.sort === "popular" ? "popular" : s.sort === "new" ? "new" : undefined,
  }),
  loaderDeps: ({ search: deps }) => deps,
  loader: async ({ deps: { q, sort = "new" } }) => ({
    q,
    sort,
    results: await search(q, sort),
  }),
  component: SearchResults,
});

function SearchResults() {
  const { q, sort, results } = Route.useLoaderData();
  const params = Route.useSearch();
  const navigate = Route.useNavigate();

  useEffect(() => {
    if (!params.sort)
      navigate({ search: (prev) => ({ ...prev, sort: "new" }), replace: true });
  }, [params.sort, navigate]);

  return (
    <div className="page">
      <Header title={`"${q}" 검색 결과`} />
      <div className="content">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            navigate({ search: { q: String(value ?? "") } });
          }}
        >
          <input
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            key={q}
          />
        </form>
      </div>
      <nav className="tabs">
        <Link
          to="/search/results"
          search={{ q, sort: "new" }}
          replace
          className={sort === "new" ? "on" : undefined}
        >
          최신순
        </Link>
        <Link
          to="/search/results"
          search={{ q, sort: "popular" }}
          replace
          className={sort === "popular" ? "on" : undefined}
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
          <Link to="/items/$id" params={{ id: String(item.id) }}>
            {item.title}
          </Link>
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
