import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { search as searchItems, type Item } from "../../api";
import { Header } from "../../ui";

export const Route = createFileRoute("/search/results")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { q: string; sort?: "new" | "popular" } => ({
    q: typeof s.q === "string" ? s.q : "",
    sort: s.sort === "new" || s.sort === "popular" ? s.sort : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: { q, sort = "new" } }) => searchItems({ data: { q, sort } }),
  component: SearchResults,
});

function SearchResults() {
  const { q, sort } = Route.useSearch();
  const results = Route.useLoaderData();
  const navigate = useNavigate({ from: "/search/results" });

  useEffect(() => {
    if (!sort)
      navigate({ search: (prev) => ({ ...prev, sort: "new" }), replace: true });
  }, [sort, navigate]);

  return (
    <div className="page">
      <Header title={`"${q}" 검색 결과`} />
      <div className="content">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q");
            navigate({ search: { q: String(value) } });
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
          from="/search/results"
          search={{ q, sort: "new" }}
          replace
          aria-current={(sort ?? "new") === "new"}
        >
          최신순
        </Link>
        <Link
          from="/search/results"
          search={{ q, sort: "popular" }}
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
